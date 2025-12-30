# Certificate Fix for Windows PowerShell

## The Issue
PowerShell certificate commands are failing. This is preventing both `npm start` and `npm run package`.

## Quick Fix - Run as Administrator

1. **Close current terminal**

2. **Open PowerShell as Administrator**
   - Press Windows key
   - Type "PowerShell"
   - Right-click → "Run as Administrator"

3. **Navigate to project:**
   ```powershell
   cd "C:\Users\rocks\OneDrive\Documents\FloorMapsVisual"
   ```

4. **Create certificate manually:**
   ```powershell
   $certPath = "$env:APPDATA\npm\node_modules\powerbi-visuals-tools\certs"
   New-Item -ItemType Directory -Path $certPath -Force -ErrorAction SilentlyContinue
   
   $cert = New-SelfSignedCertificate -Subject "CN=localhost" -TextExtension "2.5.29.17={text}DNS=localhost" -CertStoreLocation "Cert:\CurrentUser\My" -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(5)
   
   $pwd = ConvertTo-SecureString -String "PowerBIVisualTest123!" -Force -AsPlainText
   
   Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($cert.Thumbprint)" -FilePath "$certPath\PowerBICustomVisualTest_public.pfx" -Password $pwd
   
   Export-Certificate -Cert "Cert:\CurrentUser\My\$($cert.Thumbprint)" -FilePath "$certPath\PowerBICustomVisualTest_public.cer"
   ```

5. **Now package the visual:**
   ```powershell
   npm run package
   ```

## If Still Not Working

Try using the global pbiviz command directly:
```powershell
pbiviz package --no-pbiviz
```

Or manually build with webpack:
```powershell
npx webpack --mode production
```

## Alternative: Test in Power BI Service

You can also test without packaging by using Power BI Service developer mode:
1. Go to **app.powerbi.com**
2. **Settings** → **Developer** → Enable **Developer mode**
3. In a report, use the Developer Visual icon (</>)
4. The visual will look for `https://localhost:8080` (but we can't run that without the cert)

## Best Option Right Now

Since certificate creation is blocked, the easiest path is:

1. **Use another machine** where certificates work
2. **Or use Command Prompt instead of PowerShell:**
   ```cmd
   npm run package
   ```
3. **Or build manually then zip the files**

Let me know which approach you'd like to try!
