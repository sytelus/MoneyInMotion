# MoneyInMotion - Installation, Build Instructions, and Dependencies

## Prerequisites

### Required Software
- **Visual Studio 2013 or later** (2017+ recommended for better .NET 4.5 tooling)
  - Workloads: ASP.NET and web development, .NET desktop development
- **.NET Framework 4.5** (included with Windows 8+ and Visual Studio)
- **Node.js** (for JavaScript build tools)
- **Git** (for cloning the repository)

### Optional
- **IIS** or **IIS Express** (for running the Web API; IIS Express ships with Visual Studio)
- **Dropbox** (for default data storage location)

---

## Getting the Source Code

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
```

The repository includes a git submodule for CommonUtils:
```bash
git submodule update --init --recursive
```

---

## Building the .NET Solution

### Using Visual Studio
1. Open `MoneyAI.sln` in Visual Studio
2. Right-click the solution in Solution Explorer -> **Restore NuGet Packages**
3. Build the solution (Ctrl+Shift+B or Build -> Build Solution)
4. Set the startup project to the desired UI:
   - **MoneyAI.WebApi** for the web interface
   - **MoneyAI.WinForms** for the desktop client

### Using Command Line (MSBuild)
```cmd
nuget restore MoneyAI.sln
msbuild MoneyAI.sln /p:Configuration=Release
```

---

## Building the JavaScript Frontend

The JavaScript frontend lives in `MoneyAI.JS/` and uses Grunt for build automation and Bower for package management.

### Initial Setup
```bash
cd MoneyAI.JS

# Install Node.js build dependencies
npm install

# Install Bower packages (client-side libraries)
npx bower install
# or: node_modules/.bin/bower install
```

### Build Commands
```bash
# Run full build (lint + compile LESS + minify + bundle RequireJS)
npx grunt

# Run only tests (JSHint linting)
npx grunt test

# Run only build (skip linting)
npx grunt build

# Update bower packages and copy fonts
npx grunt bowerUpdate
```

### Build Pipeline Details
The Grunt build performs these steps:
1. **clean** - Remove `.tmp` and `dist/` directories
2. **less** - Compile LESS stylesheets to CSS
3. **cssmin** - Minify CSS
4. **copy** - Copy static assets (HTML, fonts, images) to `dist/`
5. **requirejs** - Bundle AMD modules using Almond loader
6. **htmlrefs** - Update HTML file references for production
7. **htmlmin** - Minify HTML files

Output goes to `MoneyAI.JS/dist/`.

---

## Running the Application

### Web Interface (MoneyAI.WebApi + MoneyAI.JS)
1. In Visual Studio, set **MoneyAI.WebApi** as the startup project
2. Press F5 (Debug) or Ctrl+F5 (Run without debugging)
3. IIS Express will start and open the web interface in your browser
4. The web UI is served from the MoneyAI.JS project (referenced by WebApi)

### Desktop Client (MoneyAI.WinForms)
1. In Visual Studio, set **MoneyAI.WinForms** as the startup project
2. Press F5 to launch the Windows Forms application
3. Use the menu to add accounts, scan statements, and manage transactions

---

## Data Setup

### Configuring the Data Directory
The application looks for data in a Dropbox-relative path by default:
```
[User's Dropbox Folder]/MoneyAI/
```

If Dropbox is not installed, you can configure the data directory:
1. Create a directory structure:
   ```
   YourDataFolder/
   +-- Statements/
   +-- Merged/
   ```
2. Update the `FileRepository` configuration to point to your chosen path

### Adding Your First Account
1. Create a subfolder under `Statements/` (e.g., `Statements/chase-checking/`)
2. Create an `AccountConfig.json` file in that folder (see [How It Works](03-how-it-works.md#1-account-configuration))
3. Drop your CSV statement files into the folder
4. Run the application and scan for new statements

---

## Dependencies

### .NET NuGet Packages

#### MoneyAI.WebApi
| Package | Version | Purpose |
|---------|---------|---------|
| Microsoft.AspNet.WebApi | 5.0.0 | REST API framework |
| Microsoft.AspNet.Mvc | 5.0.0 | MVC framework |
| Microsoft.AspNet.Razor | 3.0.0 | View engine |
| Microsoft.AspNet.WebPages | 3.0.0 | Web Pages framework |
| Microsoft.AspNet.Web.Optimization | 1.1.2 | Bundling and minification |
| Microsoft.AspNet.WebApi.HelpPage | 5.0.0 | Auto-generated API documentation |
| Microsoft.Web.Infrastructure | 1.0.0.0 | Web infrastructure |
| Newtonsoft.Json | 5.0.8 | JSON serialization |
| jQuery | 2.0.3 | JavaScript library (server-side bundling) |
| bootstrap | 3.0.3 | CSS framework (server-side bundling) |
| Antlr | 3.5.0.2 | Parser generator (Web.Optimization dep) |
| WebGrease | 1.5.2 | Web asset optimization |
| Modernizr | 2.7.1 | Browser feature detection |
| Respond | 1.3.0 | CSS3 media query polyfill |

#### MoneyAI.Repositories
| Package | Version | Purpose |
|---------|---------|---------|
| Newtonsoft.Json | 5.0.8 | JSON serialization |

#### MoneyAI.WinForms
| Package | Version | Purpose |
|---------|---------|---------|
| Newtonsoft.Json | 5.0.8 | JSON serialization |
| RestSharp | 104.4.0 | HTTP client for API calls |

### JavaScript Bower Packages (MoneyAI.JS)
| Package | Version | Purpose |
|---------|---------|---------|
| requirejs | ~2.1.9 | AMD module loader |
| jquery | ~1.10.2 | DOM manipulation, AJAX |
| lodash | ~2.2.1 | Utility functions |
| momentjs | latest | Date handling |
| knockoutjs | custom fork | MVVM data binding |
| handlebars | latest | HTML templating |
| bootstrap | latest | UI framework |
| accounting | latest | Currency formatting |
| font-awesome | latest | Icon library |
| cryptojslib | ~3.1.2 | MD5 hashing |
| uuid-js | ~0.7.5 | UUID generation |
| mousetrap | ~1.4.6 | Keyboard shortcuts |
| typeahead.js | ~0.9.3 | Autocomplete |
| less.js | latest | CSS preprocessor |
| json3 | ~3.2.6 | JSON polyfill |
| buckets | custom fork | Data structures |
| jquery.ba-bbq | custom fork | URL hash state |
| jquery.hotkeys | latest | Keyboard events |
| jquery.cookie | latest | Cookie handling |
| modernizr | latest | Feature detection |
| requirejs-text | latest | Text file loading for AMD |
| requirejs-domready | ~2.0.1 | DOM ready plugin |

### Node.js Dev Dependencies (MoneyAI.JS)
| Package | Version | Purpose |
|---------|---------|---------|
| grunt | ~0.4.1 | Build automation |
| grunt-cli | ~0.1.9 | Grunt command line |
| grunt-contrib-concat | ~0.3.0 | File concatenation |
| grunt-contrib-uglify | ~0.2.5 | JavaScript minification |
| grunt-contrib-jshint | ~0.7.1 | JavaScript linting |
| grunt-contrib-cssmin | ~0.6.2 | CSS minification |
| grunt-contrib-clean | ~0.5.0 | File cleanup |
| grunt-contrib-htmlmin | ~0.1.3 | HTML minification |
| grunt-contrib-copy | ~0.4.1 | File copying |
| grunt-contrib-less | ~0.8.2 | LESS compilation |
| grunt-contrib-csslint | ~0.1.2 | CSS linting |
| grunt-usemin | ~2.0.0 | Build file references |
| grunt-requirejs | ~0.4.0 | RequireJS optimization |
| grunt-open | ~0.2.2 | Open browser |
| grunt-htmlrefs | ~0.4.2 | HTML references |
| grunt-bower-task | ~0.3.4 | Bower integration |
| matchdep | ~0.3.0 | Dev dependency matching |
| almond | ~0.2.6 | Lightweight AMD loader |

### Third-Party Libraries (Included in Source)
| Library | Purpose |
|---------|---------|
| ObjectListView | Enhanced ListView control for WinForms |
| ListViewPrinter | Printing support for ObjectListView |
| CommonUtils | Custom utility library (JSON, CSV, hashing) |

---

## Dependency Notes

### Age of Dependencies
This project was originally created circa 2013-2014. All dependencies reflect that era:
- .NET Framework 4.5 (end-of-life; current is .NET 8+)
- ASP.NET Web API 5.0 (superseded by ASP.NET Core)
- Bower (deprecated since 2017; npm/yarn is the modern alternative)
- Grunt (largely superseded by webpack/Vite/esbuild)
- jQuery 1.x/2.x (current is 3.x)
- Bootstrap 3.x (current is 5.x)
- Knockout.js (largely superseded by React/Vue/Svelte)

### Custom Forks
The project depends on custom forks of:
- **knockoutjs**: `git://github.com/sytelus/knockout` (pinned to specific commit)
- **buckets**: `git://github.com/sytelus/buckets` (data structures library)
- **jquery.ba-bbq**: `git://github.com/DerDu/jquery-bbq` (URL hash library)

These git:// protocol URLs may need updating to https:// for modern git clients, as the git:// protocol is no longer supported by GitHub.

### Known Compatibility Issues
- The `git://` protocol URLs in bower.json will fail with modern git (GitHub disabled unencrypted git protocol in 2022). Change to `https://` equivalents.
- Node.js version: The package.json specifies `>=0.8.0` but modern grunt versions require Node.js 12+. Use Node.js 16-18 LTS for best compatibility with these older grunt plugins.
- npm audit will show vulnerabilities in these old packages; this is expected for dependencies from 2013.
