# Installs or updates MySpec for the current user, from the latest GitHub release.
# Usage, in PowerShell: irm https://raw.githubusercontent.com/guilhermt/MySpec/main/install.ps1 | iex
#
# Everything runs inside a single block, called with &, so a download cut short
# never runs half a script and nothing is left in the session of whoever ran it.
& {
    Set-StrictMode -Version 3.0
    $ErrorActionPreference = 'Stop'

    $Repo = 'guilhermt/MySpec'
    $Package = 'myspec-windows-amd64.zip'
    $PackageUrl = "https://github.com/$Repo/releases/latest/download/$Package"
    # The identity the app gives its notifications, in internal/app/notifications_windows.go.
    # The two must be equal.
    $AppId = 'guilhermt.MySpec'
    # Path.Combine, not Join-Path: outside Windows these folders are empty, and the
    # first check must refuse the system before anything else fails.
    $AppDir = [System.IO.Path]::Combine([Environment]::GetFolderPath('LocalApplicationData'), 'Programs\MySpec')
    $ShortcutPath = [System.IO.Path]::Combine([Environment]::GetFolderPath('Programs'), 'MySpec.lnk')
    $Description = 'Orchestrates a Claude Code development workflow'

    function Stop-Install([string]$Message) {
        throw $Message
    }

    # The innermost exception says the reason in one line: PowerShell wraps the
    # exception of a .NET method call, and a Task wraps its own in an AggregateException.
    function Get-Reason($ErrorRecord) {
        $e = $ErrorRecord.Exception
        while ($e.InnerException) {
            $e = $e.InnerException
        }
        $e.Message
    }

    function Confirm-System {
        # OSDescription is only read outside Windows, which only PowerShell 7 can be.
        [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseCompatibleTypes', '', Justification = 'Read only in PowerShell 7 outside Windows')]
        param()

        # $IsWindows does not exist in Windows PowerShell 5.1, so the edition comes first.
        if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) {
            $system = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
            Stop-Install "MySpec is only published for Windows 11 x64; this system is $system"
        }
        $v = [Environment]::OSVersion.Version
        if (-not ($v.Major -ge 10 -and $v.Build -ge 22000)) {
            if ($v.Major -eq 10) {
                $system = "Windows 10 (build $($v.Build))"
            } else {
                $system = "Windows $($v.Major).$($v.Minor) (build $($v.Build))"
            }
            Stop-Install "MySpec is only published for Windows 11 x64; this system is $system"
        }

        # The machine value is AMD64 on any x64 machine, whatever the process: the
        # variable of the process and the .NET Framework lie under emulation.
        $arch = [Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE', 'Machine')
        if ($arch -ne 'AMD64') {
            Stop-Install "MySpec is only published for Windows 11 x64; this machine is $arch"
        }

        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = [Security.Principal.WindowsPrincipal]$identity
        if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
            Stop-Install 'run this command in a regular PowerShell, not one opened with "Run as administrator"'
        }
    }

    # The documented way to detect the Evergreen runtime: its client key in the
    # registry, per machine or per user.
    function Confirm-WebView2 {
        $client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
        $keys = @(
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$client",
            "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$client"
        )
        foreach ($key in $keys) {
            $item = Get-ItemProperty -LiteralPath $key -Name pv -ErrorAction SilentlyContinue
            if ($item -and $item.pv -and $item.pv -ne '0.0.0.0') {
                return
            }
        }
        Stop-Install ("MySpec needs the Microsoft Edge WebView2 Runtime, which was not found.`n" +
            'Install it from https://developer.microsoft.com/microsoft-edge/webview2/ and run this command again.')
    }

    # Redirects are not followed by the client: the script reads them one by one.
    function New-HttpClient {
        $handler = New-Object System.Net.Http.HttpClientHandler
        $handler.AllowAutoRedirect = $false
        $client = New-Object System.Net.Http.HttpClient($handler)
        # The time limit comes from the token of each request.
        $client.Timeout = [System.Threading.Timeout]::InfiniteTimeSpan
        $client.DefaultRequestHeaders.UserAgent.ParseAdd('MySpec-install')
        $client
    }

    # Waiting in short slices lets Ctrl+C stop the script during a request:
    # PowerShell only checks for the interruption between statements.
    function Wait-Task($Task) {
        while (-not $Task.Wait(200)) { }
        if ($Task.PSObject.Properties['Result']) {
            $Task.Result
        }
    }

    function Test-Redirect($Response) {
        @(301, 302, 303, 307, 308) -contains [int]$Response.StatusCode
    }

    function Resolve-Location($Response, [string]$From) {
        $location = $Response.Headers.Location
        if (-not $location) {
            throw 'redirect without a location'
        }
        if ($location.IsAbsoluteUri) {
            $location
        } else {
            [Uri]::new([Uri]$From, $location)
        }
    }

    # Returns the version and the package URL from the redirect of the stable URL,
    # which is not followed: its Location is the exact package URL of the latest release.
    function Get-LatestRelease($Client) {
        $source = New-Object System.Threading.CancellationTokenSource
        $response = $null
        try {
            try {
                $source.CancelAfter(30000)
                $request = $Client.GetAsync($PackageUrl, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $source.Token)
                $response = Wait-Task $request
            } catch {
                Stop-Install 'could not reach GitHub to find the latest release; check the connection and run this command again'
            }
            $code = [int]$response.StatusCode
            if ($code -eq 404) {
                Stop-Install 'no MySpec release is published yet'
            }
            if (-not (Test-Redirect $response)) {
                Stop-Install "unexpected answer from GitHub for the latest release: HTTP $code"
            }
            if (-not $response.Headers.Location) {
                Stop-Install 'unexpected answer from GitHub for the latest release: no Location header'
            }
            $location = Resolve-Location $response $PackageUrl
            $pattern = '^https://github\.com/[^/]+/[^/]+/releases/download/(v[0-9]+\.[0-9]+\.[0-9]+)/myspec-windows-amd64\.zip$'
            if ($location.AbsoluteUri -notmatch $pattern) {
                Stop-Install "unexpected answer from GitHub for the latest release: $location"
            }
            [pscustomobject]@{ Version = $Matches[1]; Url = $location }
        } finally {
            if ($response) {
                $response.Dispose()
            }
            $source.Dispose()
        }
    }

    # Follows up to 5 redirects, https only, and writes the body of the package to $Path.
    function Receive-Package($Client, $Release, [string]$Path) {
        $source = New-Object System.Threading.CancellationTokenSource
        $response = $null
        try {
            $source.CancelAfter(600000)
            $url = [Uri]$Release.Url
            $done = $false
            for ($hop = 0; -not $done; $hop++) {
                $request = $Client.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead, $source.Token)
                $response = Wait-Task $request
                if ($response.IsSuccessStatusCode) {
                    $done = $true
                } elseif ((Test-Redirect $response) -and $hop -lt 5) {
                    $url = Resolve-Location $response $url.AbsoluteUri
                    if ($url.Scheme -ne 'https') {
                        throw 'redirect that is not https'
                    }
                    $response.Dispose()
                    $response = $null
                } else {
                    throw "HTTP $([int]$response.StatusCode)"
                }
            }
            $file = [System.IO.File]::Create($Path)
            try {
                $stream = Wait-Task $response.Content.ReadAsStreamAsync()
                try {
                    Wait-Task $stream.CopyToAsync($file, 81920, $source.Token) | Out-Null
                } finally {
                    $stream.Dispose()
                }
            } finally {
                $file.Dispose()
            }
        } catch {
            Stop-Install "could not download MySpec $($Release.Version); check the connection and run this command again"
        } finally {
            if ($response) {
                $response.Dispose()
            }
            $source.Dispose()
        }
    }

    function Expand-Package([string]$Zip, [string]$Destination, [string]$Version) {
        try {
            [System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $Destination)
        } catch {
            Stop-Install 'the downloaded package could not be extracted'
        }
        $files = @('myspec.exe', 'myspec.ico') | ForEach-Object { Join-Path $Destination $_ }
        foreach ($file in $files) {
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
                Stop-Install "the package of MySpec $Version is missing $(Split-Path $file -Leaf)"
            }
        }
        # Nothing marks these files as downloaded, but this keeps the guarantee
        # independent of how the package arrived.
        $files | ForEach-Object { Unblock-File -LiteralPath $_ }
    }

    # Compiled once per session, before anything changes on disk, so a failure here
    # stops the install with nothing half done. A loaded type cannot be unloaded.
    # The source is C# 5: Windows PowerShell 5.1 compiles it with the .NET Framework csc.
    function Import-ShortcutType {
        # A .lnk property such as System.AppUserModel.ID is not reachable by WScript.Shell,
        # so the shortcut is written through COM: IShellLinkW, IPropertyStore and IPersistFile.
        $source = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

namespace MySpecInstall
{
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    internal class ShellLink
    {
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
    internal interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder file, int maxPath, IntPtr findData, uint flags);
        void GetIDList(out IntPtr pidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder name, int maxName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder dir, int maxPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string dir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder args, int maxPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string args);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int showCmd);
        void SetShowCmd(int showCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder iconPath, int iconPathLength, out int icon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string iconPath, int icon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string relativePath, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string file);
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct PropertyKey
    {
        public Guid fmtid;
        public uint pid;
    }

    // The 24 bytes of a PROPVARIANT on x64.
    [StructLayout(LayoutKind.Explicit)]
    internal struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointer;
        [FieldOffset(16)] public IntPtr padding;
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    internal interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value);
        void Commit();
    }

    public static class Shortcut
    {
        private const ushort VT_LPWSTR = 31;

        public static void Save(string path, string target, string workingDirectory, string icon, string description, string appId)
        {
            object link = new ShellLink();
            try
            {
                IShellLinkW shellLink = (IShellLinkW)link;
                shellLink.SetPath(target);
                shellLink.SetWorkingDirectory(workingDirectory);
                shellLink.SetIconLocation(icon, 0);
                shellLink.SetDescription(description);

                // System.AppUserModel.ID
                PropertyKey key = new PropertyKey();
                key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
                key.pid = 5;
                PropVariant value = new PropVariant();
                value.vt = VT_LPWSTR;
                value.pointer = Marshal.StringToCoTaskMemUni(appId);
                try
                {
                    IPropertyStore store = (IPropertyStore)link;
                    store.SetValue(ref key, ref value);
                    store.Commit();
                }
                finally
                {
                    Marshal.FreeCoTaskMem(value.pointer);
                }

                ((IPersistFile)link).Save(path, true);
            }
            finally
            {
                Marshal.ReleaseComObject(link);
            }
        }
    }
}
'@
        try {
            if (-not ('MySpecInstall.Shortcut' -as [type])) {
                Add-Type -TypeDefinition $source
            }
        } catch {
            Stop-Install "could not prepare the Start menu shortcut: $(Get-Reason $_)"
        }
    }

    # Whatever is still in use stays for the next run, without an error.
    function Remove-StaleCopy {
        Get-ChildItem -LiteralPath $AppDir -Filter 'myspec.exe.*.old' -File | ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        }
    }

    # Returns 'installed' or 'updated'.
    function Install-App([string]$PackageDir) {
        $exe = Join-Path $AppDir 'myspec.exe'
        $new = "$exe.new"
        $old = $null
        if (Test-Path -LiteralPath $exe -PathType Leaf) {
            $action = 'updated'
        } else {
            $action = 'installed'
        }
        try {
            New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
            Remove-StaleCopy
            # The icon goes before the swap of the executable: if it fails, the old executable is intact, and a new
            # icon next to an old executable is the same icon.
            [System.IO.File]::Copy((Join-Path $PackageDir 'myspec.exe'), $new, $true)
            [System.IO.File]::Copy((Join-Path $PackageDir 'myspec.ico'), (Join-Path $AppDir 'myspec.ico'), $true)
            if ($action -eq 'updated') {
                # Windows does not let a running executable be overwritten, but lets it be
                # renamed: the open window stays on the renamed file, and the next launch
                # finds the new one at the same path. The suffix is unique because the .old
                # of a previous update may still be in use.
                $old = "$exe.$([guid]::NewGuid().ToString('N').Substring(0, 8)).old"
                [System.IO.File]::Move($exe, $old)
            }
            try {
                [System.IO.File]::Move($new, $exe)
            } catch {
                if ($old) {
                    try {
                        [System.IO.File]::Move($old, $exe)
                    } catch {
                        Write-Verbose 'the previous executable could not be put back'
                    }
                }
                throw
            }
        } catch {
            Remove-Item -LiteralPath $new -Force -ErrorAction SilentlyContinue
            Stop-Install ("could not install MySpec in ${AppDir}: $(Get-Reason $_)`n" +
                'Close MySpec if it is open and run this command again.')
        }
        $action
    }

    function Set-StartMenuShortcut([string]$Version, [string]$Action) {
        try {
            New-Item -ItemType Directory -Path (Split-Path $ShortcutPath) -Force | Out-Null
            [MySpecInstall.Shortcut]::Save($ShortcutPath, (Join-Path $AppDir 'myspec.exe'), $AppDir, (Join-Path $AppDir 'myspec.ico'), $Description, $AppId)
        } catch {
            Stop-Install ("MySpec $Version was $Action, but the Start menu shortcut could not be created: $(Get-Reason $_)`n" +
                'Run this command again.')
        }
    }

    # Writes one line of the external requirements. $AlsoAt is another path where
    # the command also counts as found.
    function Write-Requirement([string]$Name, [string]$Text, [string]$AlsoAt) {
        $found = Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue
        if ($found -or ($AlsoAt -and (Test-Path -LiteralPath $AlsoAt -PathType Leaf))) {
            $state = 'found'
        } else {
            $state = 'not found'
        }
        Write-Host ('  {0,-7} {1,-10} {2}' -f $Name, $state, $Text)
    }

    function Write-Summary([string]$Version, [string]$Action) {
        Write-Host "MySpec $Version $Action"
        if ($Action -eq 'updated') {
            Write-Host ''
            Write-Host 'A MySpec window that is open keeps the previous version until you close it and open it again.'
        }
        Write-Host ''
        Write-Host 'MySpec is in the Start menu.'
        Write-Host ''
        Write-Host 'MySpec also needs:'
        # claude is also looked up in ~\.local\bin, where the app finds it.
        Write-Requirement 'claude' 'Claude Code, installed and logged in' (Join-Path $env:USERPROFILE '.local\bin\claude.exe')
        Write-Requirement 'gh' 'GitHub CLI, installed and logged in'
        Write-Requirement 'git' 'git with access to your repositories'
    }

    function Install-MySpec {
        Confirm-System
        Confirm-WebView2
        Add-Type -AssemblyName System.Net.Http, System.IO.Compression.FileSystem

        $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "myspec-install-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
        New-Item -ItemType Directory -Path $tmp | Out-Null
        $client = $null
        try {
            $client = New-HttpClient
            $release = Get-LatestRelease $client

            Write-Host "Downloading MySpec $($release.Version)..."
            $zip = Join-Path $tmp $Package
            $packageDir = Join-Path $tmp 'package'
            Receive-Package $client $release $zip
            Expand-Package $zip $packageDir $release.Version
            # The last preparation: from here on, only the install changes the disk.
            Import-ShortcutType

            $action = Install-App $packageDir
            Set-StartMenuShortcut $release.Version $action
            Write-Summary $release.Version $action
        } finally {
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
            if ($client) {
                $client.Dispose()
            }
        }
    }

    try {
        Install-MySpec
    } catch {
        $lines = (Get-Reason $_) -split "`n"
        Write-Host "error: $($lines[0])" -ForegroundColor Red
        $lines | Select-Object -Skip 1 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    }
}
