import fs from "fs"
import { uniq } from "lodash-es"
import path from "path"
// const markdownit = require("markdown-it")
import markdownit from "markdown-it"
const umlFileExtensions = [".pu", ".pml", ".puml", ".plantuml"]
const markdownExtensions = [
  ".md",
  ".markdown",
  ".mdown",
  ".mkdn",
  ".mdwn",
  ".mkd",
  ".mdn",
  ".md.txt",
]
export class NetworkError extends Error {
  constructor(message) {
    super(message)
    this.name = "NetworkError"
  }
}
export function retrieveCodes(files) {
  return files.reduce((accum, f) => {
    const p = path.parse(f)
    if (umlFileExtensions.indexOf(p.ext) !== -1) {
      return accum.concat({
        name: p.name,
        // TODO: files may have been deleted.
        code: fs.readFileSync(f).toString(),
        dir: p.dir,
      })
    }
    if (markdownExtensions.indexOf(p.ext) !== -1) {
      // TODO: files may have been deleted.
      const content = fs.readFileSync(f).toString()
      const dir = path.dirname(f)
      const codes = puFromMd(content)
      const formattedCodes = codes.map((code) => {
        code.dir = dir
        return code
      })
      return accum.concat(formattedCodes)
    }
    return accum
  }, [])
}

const infoRegexp = /^plantuml(?:@(.+))?:([\w-_.]+)/

function puFromMd(markdown) {
  const md = new markdownit()
  const fences = md
    .parse(markdown, {})
    .filter((token) => token.type === "fence")
    .filter((token) => infoRegexp.test(token.info))

  return fences.reduce((accum, fence) => {
    const [, umlType, name] = fence.info.match(infoRegexp) || []
    const [, typeInContent] = fence.content.match(/^(@start\w+)/) || []

    if (!name) {
      return accum
    }
    if (typeInContent) {
      return accum.concat({
        name,
        code: fence.content,
      })
    }
    const t = umlType || "uml"
    return accum.concat({
      name,
      code: [`@start${t}`, fence.content.trim(), `@end${t}`, ""].join("\n"),
    })
  }, [])
}

export async function getCommitsFromPayload(octokit, payload) {
  const commits = payload.commits
  const owner = payload.repository.owner.login
  const repo = payload.repository.name

  const res = await Promise.all(
    commits.map((commit) =>
      octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.id,
      })
    )
  )
  return res.map((res) => (<any>res).data)
}

export function updatedFiles(commits) {
  return uniq(
    commits.reduce(
      (accum: any[], commit) =>
        accum.concat(
          commit.files
            .filter((f) => f.status !== "removed")
            .map((f) => f.filename)
        ),
      []
    )
  )
}
