// Global using directives for BehavioralHealthSystem
// This file contains commonly used namespaces across the entire project

// System namespaces
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Net.Http;
global using System.Text;
global using System.Text.Json;
global using System.Text.Json.Serialization;
global using System.Threading;
global using System.Threading.Tasks;

// Microsoft namespaces
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Options;
global using Microsoft.Extensions.Caching.Memory;

// Third-party namespaces
global using FluentValidation;
global using Polly;
global using Polly.Extensions.Http;
global using Polly.Timeout;

// Project namespaces
global using BehavioralHealthSystem.Models;
global using BehavioralHealthSystem.Configuration;
global using BehavioralHealthSystem.Services.Interfaces;

// Add support for new services
global using BehavioralHealthSystem.Helpers.Models;
