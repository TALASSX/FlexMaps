"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { VisualFormattingSettingsModel } from "./settings";
import * as d3 from "d3";

interface DataPoint {
    fieldNumber: string;
    layerColor: string;
    color?: string; // optional color from conditional formatting (for backward compatibility)
    tooltip?: Record<string, string>;
    // selectionId is created when parsing data (optional, may not be available in all mappings)
    selectionId?: unknown;
}

export interface PolygonVM {
    id?: string;
    points: string; // "x1,y1 x2,y2 ..."
    color?: string | null; // hex like "#FF0000"
    selectionId?: unknown;
}

// Lightweight interface describing the parts of selection id builder we use.
interface SelectionIdBuilderLike {
    withTable?: (table: unknown, idx: number) => { createSelectionId?: () => unknown };
    withCategory?: (category: unknown, idx: number) => { createSelectionId?: () => unknown };
}

interface HostWithSelectionIdBuilder {
    createSelectionIdBuilder?: () => SelectionIdBuilderLike;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private svgContainer: HTMLElement;
    private tooltipContainer: HTMLElement;

    // Upload UI elements
    private uploadButton: HTMLButtonElement;
    private fileInput: HTMLInputElement;

    // Last render state (used when re-rendering after an upload)
    private lastSvgContent: string = "";
    private lastDataPoints: DataPoint[] = [];

    private lastShowTooltips: boolean = true;
    private lastPolygons: PolygonVM[] = [];

    private currentScale: number = 1;
    private currentTranslateX: number = 0;
    private currentTranslateY: number = 0;
    private isDragging: boolean = false;
    private startX: number = 0;
    private startY: number = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();

        this.target = options.element;
        this.target.style.overflow = "hidden";
        this.target.style.position = "relative";

        // Create SVG container
        this.svgContainer = document.createElement("div");
        this.svgContainer.className = "svg-container";
        this.svgContainer.style.width = "100%";
        this.svgContainer.style.height = "100%";
        this.svgContainer.style.transformOrigin = "0 0";
        this.target.appendChild(this.svgContainer);

        // Create tooltip container
        this.tooltipContainer = document.createElement("div");
        this.tooltipContainer.className = "tooltip-container";
        this.tooltipContainer.style.display = "none";
        this.target.appendChild(this.tooltipContainer);

        // Setup zoom and pan
        this.setupZoomPan();

        // Create Upload button and hidden file input on the visual surface
        this.uploadButton = document.createElement("button");
        this.uploadButton.className = "upload-button";
        this.uploadButton.textContent = "Upload SVG";
        this.uploadButton.title = "Upload SVG file";
        this.uploadButton.addEventListener("click", () => this.fileInput.click());
        this.target.appendChild(this.uploadButton);

        // Hidden file input to accept SVG files
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.accept = ".svg";
        this.fileInput.style.display = "none";
        this.fileInput.addEventListener("change", (e: Event) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    const text = String(reader.result || "");

                    // Update formatting setting and persist the SVG content so it is saved in the report
                    try {
                        if (this.formattingSettings?.svgSettings) {
                            this.formattingSettings.svgSettings.svgContent.value = text;
                        }

                        const instances: powerbi.VisualObjectInstancesToPersist = {
                            replace: [
                                {
                                    objectName: "svgSettings",
                                    selector: null,
                                    properties: {
                                        svgContent: text
                                    }
                                }
                            ]
                        };

                        // Persist properties via host (save to the PBIX)
                        const hostWithPersist = this.host as unknown as { persistProperties?: (instances: powerbi.VisualObjectInstancesToPersist) => void };
                        if (hostWithPersist && hostWithPersist.persistProperties) {
                            hostWithPersist.persistProperties(instances);
                        }
                    } catch (err) {
                        // If persistence fails, log and continue to render the uploaded SVG
                        // (persistence requires the visual to be hosted in Power BI)
                        console.warn("Failed to persist SVG content:", err);
                    }

                    this.lastSvgContent = text;

                    // Re-render with uploaded SVG (no status mapping required)
                    // use last known polygon opacity from settings when re-rendering after upload
                    const polySettings = this.formattingSettings?.polygonSettings;
                    const polyEnabled = polySettings?.enableTransparency?.value ?? true;
                    let polyPercent = Number(String(polySettings?.transparencyPercent?.value ?? "40"));
                    if (isNaN(polyPercent)) polyPercent = 40;
                    polyPercent = Math.max(0, Math.min(100, polyPercent));
                    const polygonOpacity = polyEnabled ? (polyPercent / 100) : 1;

                    this.renderSVG(this.lastSvgContent, this.lastDataPoints, "#CCCCCC", this.lastShowTooltips, polygonOpacity, this.lastPolygons);
                };
                reader.readAsText(file);
                // reset input so same file can be selected again
                input.value = "";
            }
        });
        this.target.appendChild(this.fileInput);
    }

    private setupZoomPan(): void {
        // Mouse wheel zoom
        this.target.addEventListener("wheel", (e: WheelEvent) => {
            if (!this.formattingSettings?.displaySettings?.enableZoom?.value) return;

            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.currentScale *= delta;
            this.currentScale = Math.min(Math.max(0.1, this.currentScale), 10);
            this.applyTransform();
        });

        // Mouse drag pan
        this.target.addEventListener("mousedown", (e: MouseEvent) => {
            if (!this.formattingSettings?.displaySettings?.enableZoom?.value) return;

            this.isDragging = true;
            this.startX = e.clientX - this.currentTranslateX;
            this.startY = e.clientY - this.currentTranslateY;
            this.target.style.cursor = "grabbing";
        });

        this.target.addEventListener("mousemove", (e: MouseEvent) => {
            if (!this.isDragging) return;

            this.currentTranslateX = e.clientX - this.startX;
            this.currentTranslateY = e.clientY - this.startY;
            this.applyTransform();
        });

        this.target.addEventListener("mouseup", () => {
            this.isDragging = false;
            this.target.style.cursor = "default";
        });

        this.target.addEventListener("mouseleave", () => {
            this.isDragging = false;
            this.target.style.cursor = "default";
        });

        // Double-click to reset
        this.target.addEventListener("dblclick", () => {
            this.currentScale = 1;
            this.currentTranslateX = 0;
            this.currentTranslateY = 0;
            this.applyTransform();
        });
    }

    private applyTransform(): void {
        this.svgContainer.style.transform =
            `translate(${this.currentTranslateX}px, ${this.currentTranslateY}px) scale(${this.currentScale})`;
    }

    public update(options: VisualUpdateOptions): void {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews[0]
        );

        const dataView = options.dataViews?.[0];
        if (!dataView) return;


        // Get SVG content from settings
        const svgContent = this.formattingSettings?.svgSettings?.svgContent?.value || "";

        // Get color settings
        const defaultColor = "#CCCCCC";
        const showTooltips = this.formattingSettings?.displaySettings?.showTooltips?.value ?? true;

        // No status mapping: colors come directly from data `layerColor` column

        // Get polygon transparency settings
        const polySettings = this.formattingSettings?.polygonSettings;
        const polyEnabled = polySettings?.enableTransparency?.value ?? true;
        let polyPercent = Number(String(polySettings?.transparencyPercent?.value ?? "40"));
        if (isNaN(polyPercent)) polyPercent = 40;
        polyPercent = Math.max(0, Math.min(100, polyPercent));
        const polygonOpacity = polyEnabled ? (polyPercent / 100) : 1;

        // Parse data from dataView
        const dataPoints = this.parseDataView(dataView);
        const polygons = this.parsePolygonsFromDataView(dataView);

        // Store last render parameters for reuse after an upload
        this.lastSvgContent = svgContent;
        this.lastDataPoints = dataPoints;

        this.lastShowTooltips = showTooltips;
        this.lastPolygons = polygons;

        // Render SVG and overlay polygons
        this.renderSVG(svgContent, dataPoints, defaultColor, showTooltips, polygonOpacity, polygons);
    }

    private parsePolygonsFromDataView(dataView: DataView): PolygonVM[] {
        const result: PolygonVM[] = [];
        if (!dataView?.table?.rows || !dataView?.table?.columns) return result;

        const columns = dataView.table.columns;
        const rows = dataView.table.rows;

        let pointsIndex = -1;
        let colorIndex = -1;
        let fieldNumberIndex = -1;
        columns.forEach((col, i) => {
            if (col.roles?.["points"] || col.roles?.["polygonPoints"]) pointsIndex = i;
            if (col.roles?.["layerColor"] || col.roles?.["color"]) colorIndex = i;
            if (col.roles?.["fieldNumber"]) fieldNumberIndex = i;
        });

        rows.forEach((row, idx) => {
            if (pointsIndex < 0) return;
            const ptsCell = row[pointsIndex];
            const rawPoints = (ptsCell && typeof ptsCell === "object" && (ptsCell as { value?: unknown }).value !== undefined)
                ? String((ptsCell as { value?: unknown }).value)
                : String(ptsCell ?? "");
            if (!rawPoints) return;

            let color: string | null = null;
            if (colorIndex >= 0) {
                const ccell = row[colorIndex];
                if (ccell !== undefined && ccell !== null) {
                    if (typeof ccell === "object") {
                        const co = ccell as { value?: unknown; objects?: unknown };
                        if (co.value !== undefined) color = String(co.value).trim() || null;
                        // ignore complex objects for color extraction here (use explicit value if provided)
                    } else {
                        color = String(ccell).trim() || null;
                    }
                }
            }

            const id = (fieldNumberIndex >= 0) ? String(row[fieldNumberIndex] ?? `p${idx}`) : `p${idx}`;
            const polygon: PolygonVM = { id, points: rawPoints, color };
            // Try to create a selectionId for polygon row
            try {
                const builder = (this.host as unknown as HostWithSelectionIdBuilder).createSelectionIdBuilder?.();
                if (builder) {
                    if (typeof builder.withTable === 'function' && dataView.table) {
                        polygon.selectionId = builder.withTable(dataView.table, idx).createSelectionId?.();
                    }
                }
            } catch { /* ignore */ }

            result.push(polygon);
        });

        return result;
    }

    private parseDataView(dataView: DataView): DataPoint[] {
        const dataPoints: DataPoint[] = [];

        if (!dataView.table?.rows || !dataView.table?.columns) {
            return dataPoints;
        }

        const columns = dataView.table.columns;
        const rows = dataView.table.rows;

        // Find column indices

        let fieldNumberIndex = -1;
        let layerColorIndex = -1;
        const tooltipFields: Array<{ index: number; name: string }> = [];

        columns.forEach((column, index) => {
            if (column.roles?.["fieldNumber"]) {
                fieldNumberIndex = index;
            }
            if (column.roles?.["layerColor"]) {
                layerColorIndex = index;
            }
            if (column.roles?.["tooltipFields"]) {
                tooltipFields.push({ index, name: column.displayName || `col${index}` });
            }
        });

        // Helper to extract color from an object (supports common conditional formatting shapes)
        const getColorFromObject = (obj: unknown): string | null => {
            if (!obj || typeof obj !== "object") return null;

            const objAny = obj as { [key: string]: unknown };
            // Common shape: { fill: { solid: { color: "#rrggbb" } } }
            if (
                typeof objAny.fill === "object" && objAny.fill !== null &&
                "solid" in objAny.fill && typeof (objAny.fill as { solid?: unknown }).solid === "object" && (objAny.fill as { solid?: unknown }).solid !== null &&
                "color" in (objAny.fill as { solid?: { color?: unknown } }).solid
            ) {
                const solid = (objAny.fill as { solid?: { color?: unknown } }).solid;
                if (solid && typeof solid === "object" && "color" in solid) {
                    return String((solid as { color?: unknown }).color);
                }
            }

            // Sometimes the color is directly under a key as { color: "#..." }
            for (const key of Object.keys(objAny)) {
                const v = objAny[key];
                if (v && typeof v === "object") {
                    // Check for solid property
                    if (
                        "solid" in v && typeof (v as { solid?: unknown }).solid === "object" && (v as { solid?: unknown }).solid !== null &&
                        "color" in (v as { solid?: { color?: unknown } }).solid
                    ) {
                        const solid = (v as { solid?: { color?: unknown } }).solid;
                        if (solid && typeof solid === "object" && "color" in solid) {
                            return String((solid as { color?: unknown }).color);
                        }
                    }
                    // Check for color property
                    if ("color" in v) {
                        return String((v as { color?: unknown }).color);
                    }
                }
            }

            return null;
        };

        // Parse rows

        rows.forEach((row, rowIndex) => {
            const fieldCell: unknown = fieldNumberIndex >= 0 ? row[fieldNumberIndex] : undefined;
            const cellAsObj = fieldCell as { value?: unknown } | undefined;
            let fieldNumber = fieldNumberIndex >= 0 ? String((cellAsObj && cellAsObj.value !== undefined ? cellAsObj.value : fieldCell) ?? "") : "";
            fieldNumber = fieldNumber.trim();

            // layerColor cell can be a plain value or an object with { value, objects }
            let layerColorValue = "";
            if (layerColorIndex >= 0) {
                const colorCell: unknown = row[layerColorIndex];

                if (colorCell !== undefined && colorCell !== null && typeof colorCell === "object") {
                    const ccObj = colorCell as { value?: unknown; objects?: unknown };
                    if (ccObj.value !== undefined) {
                        layerColorValue = String(ccObj.value ?? "").trim();
                    }
                    if (!layerColorValue && ccObj.objects) {
                        const c = getColorFromObject(ccObj.objects);
                        if (c) layerColorValue = c;
                    }
                } else {
                    layerColorValue = String(colorCell ?? "").trim();
                }

                // Fallback: column-level conditional formatting may be present under dataView.table.columns
                if (!layerColorValue) {
                    const colObj = columns[layerColorIndex]?.objects;
                    const c = getColorFromObject(colObj);
                    if (c) layerColorValue = c;
                }
            }

            if (fieldNumber) {
                const dp: DataPoint = { fieldNumber, layerColor: layerColorValue };
                // Try to create a selectionId for this row so clicks can cross-filter
                try {
                    const builder = (this.host as unknown as HostWithSelectionIdBuilder).createSelectionIdBuilder?.();
                    if (builder) {
                        if (typeof builder.withTable === 'function' && dataView.table) {
                            dp.selectionId = builder.withTable(dataView.table, rowIndex).createSelectionId?.();
                        } else if (typeof builder.withCategory === 'function') {
                            const categorical = (dataView as unknown as { categorical?: { categories?: unknown[] } }).categorical;
                            const categories = categorical?.categories;
                            if (categories && categories.length > 0) {
                                dp.selectionId = builder.withCategory(categories[0], rowIndex).createSelectionId?.();
                            }
                        }
                    }
                } catch { /* ignore selection id creation failures */ }
                if (layerColorValue) dp.color = layerColorValue.trim();

                // extract optional tooltip values from any `tooltipFields` columns
                const tooltip: Record<string, string> = {};
                for (const tf of tooltipFields) {
                    const idx = tf.index;
                    const colName = tf.name || `col${idx}`;
                    const cell = row[idx];
                    if (cell !== undefined && cell !== null) {
                        if (typeof cell === "object") {
                            const co = cell as { value?: unknown };
                            if (co.value !== undefined) tooltip[colName] = String(co.value ?? "").trim();
                        } else {
                            tooltip[colName] = String(cell).trim();
                        }
                    }
                }

                if (Object.keys(tooltip).length > 0) dp.tooltip = tooltip;

                dataPoints.push(dp);
            }
        });

        return dataPoints;
    }

    private renderSVG(
        svgContent: string,
        dataPoints: DataPoint[],
        defaultColor: string,
        showTooltips: boolean,
        polygonOpacity: number,
        polygons: PolygonVM[] = []
    ): void {
        if (!svgContent) {
            // Create a DOM-based placeholder instead of writing HTML directly
            while (this.svgContainer.firstChild) {
                this.svgContainer.removeChild(this.svgContainer.firstChild);
            }

            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.justifyContent = "center";
            wrapper.style.height = "100%";
            wrapper.style.color = "#666";
            wrapper.style.fontFamily = "Segoe UI, sans-serif";
            wrapper.style.textAlign = "center";
            wrapper.style.padding = "20px";

            const inner = document.createElement("div");

            const emoji = document.createElement("div");
            emoji.style.fontSize = "48px";
            emoji.style.marginBottom = "10px";
            emoji.textContent = "🗺️";

            const title = document.createElement("div");
            title.style.fontSize = "14px";
            title.textContent = "Paste your SVG content in the Format pane";

            const hint = document.createElement("div");
            hint.style.fontSize = "12px";
            hint.style.color = "#999";
            hint.style.marginTop = "5px";
            hint.textContent = "SVG Settings → SVG Content";

            inner.appendChild(emoji);
            inner.appendChild(title);
            inner.appendChild(hint);
            wrapper.appendChild(inner);
            this.svgContainer.appendChild(wrapper);

            return;

        }

        // Parse and insert SVG via DOMParser to avoid unsafe innerHTML usage
        try {
            // Clear container safely
            while (this.svgContainer.firstChild) {
                this.svgContainer.removeChild(this.svgContainer.firstChild);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, "image/svg+xml");
            const parsedSvg = doc.querySelector("svg");

            if (!parsedSvg) {
                throw new Error("No <svg> element found in content");
            }

            const importedSvg = document.importNode(parsedSvg, true);
            this.svgContainer.appendChild(importedSvg);

            // Read highlight toggle from formatting settings (used for both D3 polygons and mapped SVG shapes)
            const highlightBorders = this.formattingSettings?.polygonSettings?.highlightBorders?.value ?? false;

            // Find the SVG element
            const svgElement = this.svgContainer.querySelector("svg");
            if (svgElement) {
                // Make SVG responsive
                svgElement.style.width = "100%";
                svgElement.style.height = "100%";
                svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
                // Render any polygons from dataView on top of the SVG using D3
                if (polygons && polygons.length > 0) {
                    this.renderPolygonsD3(svgElement, polygons, defaultColor, polygonOpacity, highlightBorders);
                }
            }

            // Create a map for quick lookup

            const colorMap = new Map<string, string>();
            const tooltipMap = new Map<string, Record<string, string>>();
            dataPoints.forEach(dp => {
                const key = String(dp.fieldNumber ?? "").trim().toLowerCase();
                if (dp.color) colorMap.set(key, String(dp.color).trim());
                if (dp.tooltip) tooltipMap.set(key, dp.tooltip);
            });

            // Find all elements with data-label attribute
            const labeledElements = this.svgContainer.querySelectorAll("[data-label]");

            labeledElements.forEach((element: Element) => {
                const label = element.getAttribute("data-label");
                if (!label) return;

                const labelKey = String(label).trim().toLowerCase();
                const dpColor = colorMap.get(labelKey);

                // build polygon color map from polygons parameter (if any)
                const polygonColorMap = new Map<string, string>();
                polygons.forEach(p => { if (p.id) polygonColorMap.set(String(p.id).trim().toLowerCase(), String(p.color || "").trim()); });

                // priority: data polygon color -> cell color (layerColor) -> default
                let color = "";
                const polyColor = polygonColorMap.get(labelKey);
                if (polyColor) {
                    color = polyColor;
                } else if (dpColor) {
                    color = dpColor;
                } else {
                    color = defaultColor;
                }

                const htmlElement = element as HTMLElement | SVGElement;
                if (htmlElement instanceof SVGElement) {
                    // Apply fill to common shape types inside this group (avoid recoloring text)
                    try {
                        const shapeSelector = 'rect,path,polygon,circle,ellipse,polyline';
                        const shapes = htmlElement.querySelectorAll(shapeSelector);
                        shapes.forEach((s) => {
                            if (s instanceof SVGElement) {
                                try {
                                    s.setAttribute('fill', color);
                                    s.style.fill = color;
                                    // apply semi-transparent fill so SVG beneath remains visible
                                    s.setAttribute('fill-opacity', String(polygonOpacity));
                                    s.style.fillOpacity = String(polygonOpacity);
                                } catch { /* ignore DOM exceptions */ }

                                // Handle <use> elements that reference defs
                                if (s.tagName.toLowerCase() === 'use') {
                                    const href = (s as SVGUseElement).getAttribute('href') || (s as SVGUseElement).getAttribute('xlink:href');
                                    if (href && href.startsWith('#')) {
                                        const ref = this.svgContainer.querySelector(href);
                                        if (ref instanceof SVGElement) {
                                            try {
                                                ref.setAttribute('fill', color);
                                                ref.style.fill = color;
                                                ref.setAttribute('fill-opacity', String(polygonOpacity));
                                                ref.style.fillOpacity = String(polygonOpacity);
                                            } catch { /* ignore DOM exceptions */ }
                                        }
                                    }
                                }
                                // Apply stroke highlight when enabled
                                try {
                                    if (highlightBorders) {
                                        // use the applied fill color for the border when highlighting
                                        const strokeColor = color || '#000';
                                        s.setAttribute('stroke', strokeColor);
                                        if (!s.getAttribute('stroke-width')) s.setAttribute('stroke-width', '1');
                                    }
                                } catch { /* ignore */ }
                            }
                        });
                    } catch { /* ignore DOM exceptions for read-only attributes */ }

                    // Add hover effect
                    htmlElement.style.cursor = "pointer";
                    htmlElement.style.transition = "opacity 0.2s ease";

                            htmlElement.addEventListener("mouseenter", () => {
                        htmlElement.style.opacity = "0.8";

                        if (showTooltips) {
                            const tip = tooltipMap.get(labelKey) || null;
                            this.showTooltip(label, tip, htmlElement);
                        }
                    });

                            htmlElement.addEventListener("mouseleave", () => {
                        htmlElement.style.opacity = "1";
                        this.hideTooltip();
                    });

                            // selection (cross-filter) on click
                            htmlElement.addEventListener("click", (e: Event) => {
                                e.stopPropagation();
                                try {
                                    // find matching data point and call selectionManager
                                    const dp = dataPoints.find(d => String(d.fieldNumber ?? "").trim().toLowerCase() === labelKey);
                                    if (dp && dp.selectionId !== undefined && dp.selectionId !== null) {
                                        // selectionId is an opaque value provided by Power BI; call via a minimally-typed wrapper
                                        try {
                                            const selMgr = this.selectionManager as unknown as { select: (id: unknown) => Promise<void> };
                                            selMgr.select(dp.selectionId).then(() => { /* no-op */ });
                                        } catch { /* ignore selection errors */ }
                                    }
                                } catch { /* ignore selection errors */ }
                            });
                }
            });

        } catch {
            // Create an error placeholder using DOM APIs
            while (this.svgContainer.firstChild) {
                this.svgContainer.removeChild(this.svgContainer.firstChild);
            }

            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.justifyContent = "center";
            wrapper.style.height = "100%";
            wrapper.style.color = "#c00";
            wrapper.style.fontFamily = "Segoe UI, sans-serif";
            wrapper.style.textAlign = "center";
            wrapper.style.padding = "20px";

            const inner = document.createElement("div");

            const emoji = document.createElement("div");
            emoji.style.fontSize = "48px";
            emoji.style.marginBottom = "10px";
            emoji.textContent = "⚠️";

            const title = document.createElement("div");
            title.style.fontSize = "14px";
            title.textContent = "Error parsing SVG content";

            const hint = document.createElement("div");
            hint.style.fontSize = "12px";
            hint.style.color = "#999";
            hint.style.marginTop = "5px";
            hint.textContent = "Please check that your SVG is valid";

            inner.appendChild(emoji);
            inner.appendChild(title);
            inner.appendChild(hint);
            wrapper.appendChild(inner);
            this.svgContainer.appendChild(wrapper);
        }
    }

    private renderPolygonsD3(svgElement: Element, polygons: PolygonVM[], defaultColor: string, polygonOpacity: number, highlightBorders: boolean): void {
        try {
            const svgSel = d3.select<SVGSVGElement, PolygonVM>(svgElement as unknown as SVGSVGElement);

            const sel = svgSel.selectAll<SVGPolygonElement, PolygonVM>("polygon.data-polygon").data(polygons, (d: PolygonVM) => d.id ?? d.points);

            // ENTER
            sel.enter()
                .append("polygon")
                .attr("class", "data-polygon")
                .attr("points", d => d.points)
                .attr("fill", d => d.color ?? defaultColor)
                .attr("fill-opacity", polygonOpacity)
                .attr("stroke", d => (highlightBorders ? (d.color ?? defaultColor) : "#333"))
                .attr("stroke-width", 1);

            // Attach click handler for selection on enter using DOM listener (avoids d3 typing issues)
            const selectionManager = this.selectionManager as unknown as { select: (id: unknown) => Promise<void> };
            sel.enter().each(function(this: SVGPolygonElement, d: PolygonVM) {
                try {
                    const node = this as SVGElement;
                    node.addEventListener('click', (event: Event) => {
                        try {
                            if (d && d.selectionId !== undefined && d.selectionId !== null) {
                                try { selectionManager.select(d.selectionId); } catch { /* ignore */ }
                            }
                        } catch { /* ignore */ }
                        try { event.stopPropagation(); } catch { /* ignore */ }
                    });
                } catch { /* ignore */ }
            });

            // UPDATE
            sel
                .attr("points", d => d.points)
                .transition()
                .duration(200)
                .attr("fill", d => d.color ?? defaultColor)
                .attr("fill-opacity", polygonOpacity)
                .attr("stroke", d => (highlightBorders ? (d.color ?? defaultColor) : "#333"));

            // EXIT
            sel.exit().remove();
        } catch {
            // ignore d3 errors in constrained environments
        }
    }

    private showTooltip(label: string, tooltipData: Record<string, string> | null, element: Element): void {
        const rect = element.getBoundingClientRect();
        const containerRect = this.target.getBoundingClientRect();

        // Populate tooltip using DOM APIs (avoid innerHTML)
        while (this.tooltipContainer.firstChild) {
            this.tooltipContainer.removeChild(this.tooltipContainer.firstChild);
        }

        const titleNode = document.createElement("div");
        titleNode.style.fontWeight = "bold";
        titleNode.style.marginBottom = "4px";
        titleNode.textContent = `Field: ${label}`;
        this.tooltipContainer.appendChild(titleNode);

        if (tooltipData) {
            for (const k of Object.keys(tooltipData)) {
                const n = document.createElement("div");
                n.textContent = `${k}: ${tooltipData[k]}`;
                this.tooltipContainer.appendChild(n);
            }
        }

        this.tooltipContainer.style.display = "block";
        this.tooltipContainer.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
        this.tooltipContainer.style.top = `${rect.top - containerRect.top - 10}px`;
        this.tooltipContainer.style.transform = "translate(-50%, -100%)";
    }

    private hideTooltip(): void {
        this.tooltipContainer.style.display = "none";
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
