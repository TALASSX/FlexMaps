# Quick Start Guide - FlexMaps

## Current Issue
Certificate creation is failing. This is a known issue with newer Windows PowerShell versions.

## Solution Options

### Option 1: Use Power BI Service Developer Mode (Recommended)
You can test the visual directly in Power BI Service without needing a local dev server:

1. **Package the visual first:**
   ```powershell
   npm run package
   ```

2. **Import into Power BI Desktop:**
   - Open Power BI Desktop
   - Click **...** in Visualizations pane
   - Select **Import a visual from a file**
   - Choose `dist/FlexMaps.pbiviz`

### Option 2: Manual Certificate Fix
If you need the development server:

1. **Run PowerShell as Administrator**

2. **Create certificate manually:**
   ```powershell
   $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(5)
   $pwd = ConvertTo-SecureString -String "YourPassword123!" -Force -AsPlainText
   Export-PfxCertificate -Cert $cert -FilePath "$env:APPDATA\npm\node_modules\powerbi-visuals-tools\certs\PowerBICustomVisualTest_public.pfx" -Password $pwd
   ```

3. **Then run:**
   ```powershell
   npm start
   ```

### Option 3: Package and Test (Fastest for now)
Since the visual is complete, let's just package it:

```powershell
npm run package
```

This creates `dist/FlexMaps.pbiviz` ready to use!

## Testing Your Visual

### 1. Sample Data
Create or use data with these columns:

| FieldNumber | Status |
|-------------|--------|
| 101 | booked |
| 102 | open |
| 103 | booked |
| A1 | open |
| A2 | booked |

### 2. Import Visual
- Power BI Desktop → Visualizations → **...** → **Import from file**
- Select `dist/FlexMaps.pbiviz`

### 3. Configure
- Drag **FieldNumber** to FieldNumber field
- Drag **Status** to Status field
- In Format pane → **SVG Settings** → Paste your SVG
- Set colors in **Color Settings**

### 4. Your SVG Format
Make sure SVG elements have `data-label` attributes:
```xml
<rect data-label="101" x="50" y="50" width="100" height="100"/>
<circle data-label="A1" cx="200" cy="200" r="30"/>
```

## Files Created

✅ All project files are ready:
- `src/visual.ts` - Main visual code
- `src/settings.ts` - Format pane settings
- `capabilities.json` - Data roles & options
- `package.json` - Dependencies
- `pbiviz.json` - Visual configuration
- `tsconfig.json` - TypeScript settings
- `assets/sample-floor-map.svg` - Example SVG

## Next Step

Run this command to create the .pbiviz file:
```powershell
npm run package
```

Then import it into Power BI Desktop!
