# FlexMaps - Usage Guide

## 1. Import the Visual

1. Open **Power BI Desktop**
2. In the **Visualizations** pane, click the **"..."** (ellipsis)
3. Select **"Import a visual from a file"**
4. Browse to `dist\FlexMaps1234567890.1.0.0.pbiviz`
5. Click **"OK"** on the security warning

## 2. Prepare Your Data

Your data needs two columns:

### Required Columns:
- **fieldNumber**: Text/ID that matches the `data-label` attribute in your SVG elements
- **status**: Status values (e.g., "Available", "Occupied", "Maintenance")

### Example Data:
```
fieldNumber | status
------------|----------
101         | Occupied
102         | Available
103         | Maintenance
104         | Available
```

## 3. Configure Your SVG

Your SVG file must have `data-label` attributes on elements you want to color:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect data-label="101" x="10" y="10" width="80" height="60" fill="#ccc"/>
  <text x="50" y="40">Room 101</text>
  
  <rect data-label="102" x="100" y="10" width="80" height="60" fill="#ccc"/>
  <text x="140" y="40">Room 102</text>
  
  <!-- Add more rooms/areas -->
</svg>
```

## 4. Use the Visual

1. **Add the visual** to your report canvas
2. **Drag fields** to the visual:
   - `fieldNumber` → **Field Number** field well
   - `status` → **Status** field well

3. **Open Format pane** and configure:

### SVG Content Section:
- **SVG Content**: Paste your entire SVG code here
- **Default Color**: Color for unmatched elements (default: #cccccc)

### Colors Section:
Add color mappings for each status:
- **Available**: #4CAF50 (green)
- **Occupied**: #F44336 (red)
- **Maintenance**: #FFC107 (amber)
- Add more as needed

### Display Section:
- **Enable Zoom**: Turn on/off zoom functionality
- **Initial Zoom**: Starting zoom level (1.0 = 100%)
- **Enable Pan**: Turn on/off pan/drag functionality

## 5. Interaction

- **Hover**: Shows tooltip with field number and status
- **Mouse Wheel**: Zoom in/out (if enabled)
- **Click + Drag**: Pan around the SVG (if enabled)

## Tips

- Use consistent `data-label` values between your data and SVG
- Test with a small SVG first to ensure labels match
- Colors auto-update when data refreshes
- SVG is cached after first load for performance
