using 'main.bicep'

// Required parameters - these will be provided at deployment time
param functionAppName = ''
param kintsugiApiKey = ''

// Optional parameters with defaults
param webAppName = ''
param location = ''
param environment = 'dev'
param storageAccountName = ''
param azureOpenAIEndpoint = ''
param azureOpenAIApiKey = ''
