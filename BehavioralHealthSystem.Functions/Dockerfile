# Stage 1: Build the .NET Function App
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

# Copy the solution and project files
COPY BehavioralHealthSystem.sln ./
COPY BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj ./BehavioralHealthSystem.Functions/
COPY BehavioralHealthSystem.Helpers/BehavioralHealthSystem.Helpers.csproj ./BehavioralHealthSystem.Helpers/

# Restore dependencies
RUN dotnet restore BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj

# Copy all source code
COPY BehavioralHealthSystem.Functions/ ./BehavioralHealthSystem.Functions/
COPY BehavioralHealthSystem.Helpers/ ./BehavioralHealthSystem.Helpers/

# Build and publish
WORKDIR /src/BehavioralHealthSystem.Functions
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Runtime image with Azure Functions runtime
FROM mcr.microsoft.com/azure-functions/dotnet-isolated:4-dotnet-isolated8.0

WORKDIR /home/site/wwwroot

# Copy published output
COPY --from=build /app/publish .

# Set environment variables for Azure Functions
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    FUNCTIONS_WORKER_RUNTIME=dotnet-isolated

# The Azure Functions runtime will handle the port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:80/api/health || exit 1
