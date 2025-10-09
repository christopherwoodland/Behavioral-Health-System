// Global using directives for BehavioralHealthSystem.Functions
// This file contains commonly used namespaces across the entire Azure Functions project

// System namespaces
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Net;
global using System.Net.Http;
global using System.Net.Http.Headers;
global using System.Text;
global using System.Text.Json;
global using System.Text.Json.Serialization;
global using System.Threading.Tasks;

// Microsoft namespaces
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Options;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.Hosting;

// Azure namespaces
global using Azure.Storage.Blobs;

// Azure Functions namespaces
global using Microsoft.Azure.Functions.Worker;
global using Microsoft.Azure.Functions.Worker.Http;

// Third-party namespaces
global using FluentValidation;

// Project-specific namespaces
global using BehavioralHealthSystem.Models;
global using BehavioralHealthSystem.Configuration;
global using BehavioralHealthSystem.Services;
global using BehavioralHealthSystem.Services.Interfaces;
global using BehavioralHealthSystem.Validators;

// New async job service namespaces
global using BehavioralHealthSystem.Helpers.Models;
global using BehavioralHealthSystem.Helpers.Services;
