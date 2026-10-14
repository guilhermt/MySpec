# Settings of PSScriptAnalyzer for install.ps1, run by task lint:ps.
@{
    Severity     = @('Error', 'Warning')
    ExcludeRules = @(
        # The installer talks to the console of whoever runs it.
        'PSAvoidUsingWriteHost',
        # The installer has no -WhatIf; it is one command a person runs on purpose.
        'PSUseShouldProcessForStateChangingFunctions'
    )
    Rules        = @{
        # install.ps1 runs in Windows PowerShell 5.1, which comes with Windows 11, and in PowerShell 7.
        PSUseCompatibleSyntax   = @{ Enable = $true; TargetVersions = @('5.1', '7.0') }
        PSUseCompatibleCommands = @{
            Enable         = $true
            TargetProfiles = @(
                'win-48_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework',
                'win-4_x64_10.0.18362.0_7.0.0_x64_3.1.2_core'
            )
        }
        PSUseCompatibleTypes    = @{
            Enable         = $true
            TargetProfiles = @(
                'win-48_x64_10.0.17763.0_5.1.17763.316_x64_4.0.30319.42000_framework',
                'win-4_x64_10.0.18362.0_7.0.0_x64_3.1.2_core'
            )
        }
    }
}
