# Updated version
## new features include:
- support for custom servers
  - with basic authentication if enabled via
  ```javascript
  headers["Authorization"] = `Basic ${basicAuth}`
  ```
- verified that `.pulm` files actually generate svg
- updated config to work with esm
- it's now possible to run with node locally with minimal setup, however the octokit will fallback to this repo, so if you'd like to test something locally, fork the repo and change the credentials inside main.ts
---
[![Maintainability](https://api.codeclimate.com/v1/badges/a21c7671c0a7ae182c28/maintainability)](https://codeclimate.com/github/grassedge/generate-plantuml-action/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/a21c7671c0a7ae182c28/test_coverage)](https://codeclimate.com/github/grassedge/generate-plantuml-action/test_coverage)
[![Actions Status](https://github.com/grassedge/generate-plantuml-action/workflows/tests/badge.svg)](https://github.com/grassedge/generate-plantuml-action/actions)

# generate-plantuml-action

Generate uml diagrams with Plantuml Server and push them to your repository.

This action ease you to maintain UML.
UML is very useful, but there are some difficulties to maintain.
[PlantUML](https://plantuml.com/) enables you to write UML with text code, that is engineer-friendly so you would like it.

This actions generate UML diagrams from plantuml code
with [PlantUML Server](https://plantuml.com/en/server) when you commit plantUML files
or Markdown files that plantuml code is written in.

PlantUML files must end in either of
- `.pu`
- `.pml`
- `.puml`
- `.plantuml`

Markdown files must end in
- `.md`
- `.markdown`
- `.mdown`
- `.mkdn`
- `.mdwn`
- `.mkd`
- `.mdn`
- `.md.txt`

## Usage

This Action subscribes to Push events.

```workflow
name: generate plantuml
on:
  push:
    branches:
      - main
jobs:
  generate_plantuml:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    name: plantuml
    steps:
      - name: checkout
        uses: actions/checkout@v4.1.1
      - name: plantuml
        id: plantuml
        uses: kolchurinvv/generate-plantuml-action@master
        with:
          server: "https://your.plantuml.server"
          username: ${{ secrets.USERNAME }}
          password: ${{ secrets.PASSWORD }}
        #   path: "."
        env:
          GITHUB_TOKEN: ${{ secrets.MY_PAT }}
```

*input*

- `path` : specify the path to save generated svg files  
  the default (`.`) saves each SVG file in the same folder as the source
  file it was generated from
- `message` : specify the commit message for the commit of generated
  svg files (defaults to `Render PlantUML files`)

*env*

- `GITHUB_TOKEN` : *required* GitHub Token of your repository to commit svg files.

## Demo

see [examples](./example/sample.md) here.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).
