# FlexMaps

Multi-layer floor visuals, simplified.

## Features

- **SVG Loading**: Paste any SVG content directly in the Format pane
- **Data Binding**: Map your data fields to SVG elements using `data-label` attributes
- **Status Coloring**: Automatically color elements based on status (booked/open)
- **Configurable Colors**: Customize colors for Booked, Open, and Default states
- **Interactive**: Tooltips on hover, zoom, and pan support

## Installation

### Prerequisites
- Node.js (v14 or later)
- Power BI Desktop
- Power BI Visual Tools (`pbiviz`)

### Install pbiviz globally
```bash
npm install -g powerbi-visuals-tools
```

### Install dependencies
```bash
npm install
```

## Development

### Start development server
```bash
npm start
# or
pbiviz start
```

This starts a local server at `https://localhost:8080`

### Enable Developer Mode in Power BI
1. Go to **Power BI Service** (app.powerbi.com)
2. Click **Settings** (gear icon) → **Settings**
3. Go to **Developer** → Enable **Developer mode**

### Test in Power BI Desktop
1. Create a new report
2. In the Visualizations pane, click the **Developer Visual** (`</>` icon)
3. The visual will connect to your local dev server

## Data Setup

### Required Data Fields

| Field | Description |
|-------|-------------|
| **FieldNumber** | The identifier that matches `data-label` attributes in your SVG |
| **Status** | The status value: "booked", "occupied", "reserved" OR "open", "available", "free" |

### Example Data

| FieldNumber | Status |
|-------------|--------|
| 101 | booked |
| 102 | open |
| A1 | booked |
| A2 | open |
| P1 | booked |
| P2 | open |

## SVG Preparation

Your SVG elements need `data-label` attributes that match your FieldNumber values:

```xml
<svg viewBox="0 0 800 600">
  <rect data-label="101" x="50" y="50" width="150" height="120"/>
  <rect data-label="102" x="220" y="50" width="150" height="120"/>
  <circle data-label="A1" cx="100" cy="400" r="25"/>
  <circle data-label="A2" cx="170" cy="400" r="25"/>
</svg>
```

A sample SVG is provided in `assets/sample-floor-map.svg`.

## Format Pane Options

### SVG Settings
- **SVG Content**: Paste your complete SVG code here

### Color Settings
- **Booked Color**: Color for booked/occupied/reserved items (default: red)
- **Open Color**: Color for open/available/free items (default: teal)
- **Default Color**: Color for items without a matching status (default: gray)

### Display Settings
- **Show Tooltips**: Enable/disable hover tooltips
- **Enable Zoom & Pan**: Enable mouse wheel zoom and drag-to-pan

## Packaging for Distribution

```bash
npm run package
# or
pbiviz package
```

This creates `dist/FlexMaps.pbiviz` which can be imported into Power BI.

## Importing the Visual

1. In Power BI Desktop, go to **Visualizations** pane
2. Click the **...** (more options) → **Import a visual from a file**
3. Select your `.pbiviz` file
4. The visual will appear in your visualizations

## Troubleshooting

### Visual not loading
- Ensure the development server is running (`npm start`)
- Check that Developer mode is enabled in Power BI
- Clear browser cache and refresh

### SVG not displaying
- Verify SVG is valid XML
- Check for special characters that need escaping
- Ensure SVG has proper viewBox attribute

### Colors not applying
- Verify `data-label` attributes match your FieldNumber values exactly (case-sensitive)
- Check that Status values are correct ("booked", "open", etc.)

## License

MIT
