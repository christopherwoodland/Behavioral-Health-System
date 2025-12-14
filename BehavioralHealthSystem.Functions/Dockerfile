# Stage 1: Build the .NET Function App
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

# Copy the solution and project files
COPY BehavioralHealthSystem.sln ./
COPY BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj ./BehavioralHealthSystem.Functions/
COPY BehavioralHealthSystem.Helpers/BehavioralHealthSystem.Helpers.csproj ./BehavioralHealthSystem.Helpers/

# Restore dependencies
RUN dotnet restore BehavioralHealthSystem.Functions/BehavioralHealthSystem.Functions.csproj

# Copy source code (excluding obj/bin folders via .dockerignore)
COPY BehavioralHealthSystem.Functions/*.cs ./BehavioralHealthSystem.Functions/
COPY BehavioralHealthSystem.Functions/*.json ./BehavioralHealthSystem.Functions/
COPY BehavioralHealthSystem.Functions/Functions/ ./BehavioralHealthSystem.Functions/Functions/
COPY BehavioralHealthSystem.Functions/Services/ ./BehavioralHealthSystem.Functions/Services/
COPY BehavioralHealthSystem.Functions/Prompts/ ./BehavioralHealthSystem.Functions/Prompts/
COPY BehavioralHealthSystem.Functions/Properties/ ./BehavioralHealthSystem.Functions/Properties/
COPY BehavioralHealthSystem.Helpers/*.cs ./BehavioralHealthSystem.Helpers/
COPY BehavioralHealthSystem.Helpers/Configuration/ ./BehavioralHealthSystem.Helpers/Configuration/
COPY BehavioralHealthSystem.Helpers/Models/ ./BehavioralHealthSystem.Helpers/Models/
COPY BehavioralHealthSystem.Helpers/Services/ ./BehavioralHealthSystem.Helpers/Services/
COPY BehavioralHealthSystem.Helpers/Validators/ ./BehavioralHealthSystem.Helpers/Validators/
COPY BehavioralHealthSystem.Helpers/Deploy/ ./BehavioralHealthSystem.Helpers/Deploy/

# Build and publish (do full restore to avoid Windows path issues)
WORKDIR /src/BehavioralHealthSystem.Functions
RUN dotnet publish -c Release -o /app/publish

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
