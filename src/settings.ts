"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * SVG Settings - for loading SVG content
 */
class SVGSettingsCard extends FormattingSettingsCard {
    svgContent = new formattingSettings.TextArea({
        name: "svgContent",
        displayName: "SVG Content",
        description: "Paste your SVG content here. Elements should have data-label attributes matching your FieldNumber values.",
        placeholder: "Paste SVG content here...",
        value: ""
    });

    name: string = "svgSettings";
    displayName: string = "SVG Settings";
    slices: Array<FormattingSettingsSlice> = [this.svgContent];
}



/**
 * Display Settings - for tooltips and zoom
 */
class DisplaySettingsCard extends FormattingSettingsCard {
    showTooltips = new formattingSettings.ToggleSwitch({
        name: "showTooltips",
        displayName: "Show Tooltips",
        description: "Show tooltips when hovering over elements",
        value: true
    });

    enableZoom = new formattingSettings.ToggleSwitch({
        name: "enableZoom",
        displayName: "Enable Zoom & Pan",
        description: "Enable mouse wheel zoom and drag to pan",
        value: true
    });

    name: string = "displaySettings";
    displayName: string = "Display Settings";
    slices: Array<FormattingSettingsSlice> = [this.showTooltips, this.enableZoom];
}

/**
 * Polygon Settings - control polygon transparency
 */
class PolygonSettingsCard extends FormattingSettingsCard {
    enableTransparency = new formattingSettings.ToggleSwitch({
        name: "enableTransparency",
        displayName: "Enable Polygon Transparency",
        description: "Make polygon fills transparent by default and when colored",
        value: true
    });

    transparencyPercent = new formattingSettings.TextInput({
        name: "transparencyPercent",
        displayName: "Transparency (%)",
        description: "Opacity percentage to apply to polygon fills (0-100)",
        placeholder: "40",
        value: "40"
    });

    highlightBorders = new formattingSettings.ToggleSwitch({
        name: "highlightBorders",
        displayName: "Highlight polygon borders",
        description: "Use the applied polygon color for the polygon border",
        value: false
    });

    name: string = "polygonSettings";
    displayName: string = "Polygon Transparency";
    slices: Array<FormattingSettingsSlice> = [this.enableTransparency, this.transparencyPercent, this.highlightBorders];
}

// Status mapping removed: colors are provided via the `layerColor` data column.

/**
 * Visual Formatting Settings Model
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    svgSettings = new SVGSettingsCard();
    displaySettings = new DisplaySettingsCard();
    polygonSettings = new PolygonSettingsCard();

    cards = [this.svgSettings, this.displaySettings, this.polygonSettings];
}
