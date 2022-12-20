try {
	$path = $MyInvocation.MyCommand.Path
	$dir = Split-Path $path

	Write-Host "Reading web.config located at $dir"

	$oldWebConfig = Get-Content -Path $dir\web.config -Raw

	$smtpConfig =        [regex]::match($oldWebConfig, '(?smi)<mailSettings>(.+)</mailSettings>').Value
	$clConfig =          [regex]::match($oldWebConfig, '(?smi)<campusLogicConfig>(.+)</campusLogicConfig>').Value
	$connectionStrings = [regex]::match($oldWebConfig, '(?smi)<connectionStrings>(.+)</connectionStrings>').Value
	$appSettings =       [regex]::match($oldWebConfig, '(?smi)<appSettings>(.+)</appSettings>').Value

	Write-Host "Reading web.update.config located at $dir"

	$newWebConfig = Get-Content -Path $dir\web.update.config -Raw

	# Preserve ClConnectVersion
	$newVersion = [regex]::match($newWebConfig, '(?smi)<add key="ClConnectVersion" value="(.+?)"\s*/>').Value
	$appSettings = [regex]::Replace($appSettings, '(?smi)<add key="ClConnectVersion" value="(.+?)"\s*/>',"$newVersion")

	# Replace v11.0 with mssqllocaldb in connectionStrings if applicable
	$connectionStrings = [regex]::Replace($connectionStrings,"(?smi)\(LocalDb\)\\v11.0","(LocalDb)\mssqllocaldb")

	# check our strings
	if (-Not $smtpConfig) { 
		Write-Host "Error occurred when copying <mailSettings>. Exiting..."
		Exit 1
	}
	if (-Not $clConfig) { 
		Write-Host "Error occurred when copying <campusLogicConfig>. Exiting..."
		Exit 1
	}
	if (-Not $connectionStrings) { 
		Write-Host "Error occurred when copying <connectionStrings>. Exiting..."
		Exit 1
	}
	if (-Not $appSettings) { 
		Write-Host "Error occurred when copying <appSettings>. Exiting..."
		Exit 1
	}

    

	# replace sections
    Write-Host "Copying <mailSettings> section"
	$newWebConfig = [regex]::Replace($newWebConfig,'(?smi)<mailSettings>(.+)</mailSettings>',"$smtpConfig")
    Write-Host "Copying <campusLogicConfig> section"
	$newWebConfig = [regex]::Replace($newWebConfig,'(?smi)<campusLogicConfig>(.+)</campusLogicConfig>',"$clConfig")
    Write-Host "Copying <connectionStrings> section"
	$newWebConfig = [regex]::Replace($newWebConfig,'(?smi)<connectionStrings>(.+)</connectionStrings>',"$connectionStrings")
    Write-Host "Copying <appSettings> section"
	$newWebConfig = [regex]::Replace($newWebConfig,'(?smi)<appSettings>(.+)</appSettings>',"$appSettings")


	if ($newWebConfig) {
	    # Write to web.config
        Write-Host "Writing updated web.config content back to web.config"
	    Set-Content -Path $dir\web.config -Value $newWebConfig
	} else {
		Write-Host "New web.config data did not have content. Update did not occur. Exiting..."
		Exit 1
	}

} catch { 
	Write-Host "An error occurred when attempting to update the web.config:"
	Write-Host $_
	WriteHost "Exiting..."
	Exit 1
}

Write-Host "web.config was updated successfully!"




