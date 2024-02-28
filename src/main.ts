// TODO logging.
import * as core from "@actions/core"
import * as github from "@actions/github"
import axios from "axios"
import { Base64 } from "js-base64"
import path from "path"
import plantumlEncoder from "plantuml-encoder"

import {
  retrieveCodes,
  getCommitsFromPayload,
  updatedFiles,
  NetworkError,
} from "./utils.js"

const diagramPath = core.getInput("path")
const commitMessage = core.getInput("message")
const server = core.getInput("server")
const username = core.getInput("username")
const password = core.getInput("password")

type GenerateSvgPayload = {
  code: string
  server?: string
  username?: string
  password?: string
}

async function generateSvg(payload: GenerateSvgPayload) {
  const encoded = plantumlEncoder.encode(payload.code)
  try {
    let res
    let headers = {}
    if (payload.server) {
      if (payload.username && payload.password) {
        headers = {
          auth: {
            username: core.getInput("username"),
            password: core.getInput("password"),
          },
        }
      }
      res = await axios.post(`${server}/svg/${encoded}`, headers)
    } else {
      res = await axios.get(`http://www.plantuml.com/plantuml/svg/${encoded}`)
    }
    return res.data
  } catch (e) {
    if (e instanceof Error || e instanceof NetworkError) {
      core.setFailed(e)
    }
    if (typeof e === "object" && e !== null && "message" in e) {
      throw new NetworkError(e.message)
    }
    throw new NetworkError("Unknown error")
  }
}

if (!process.env.GITHUB_TOKEN) {
  core.setFailed("Please set GITHUB_TOKEN env var.")
  process.exit(1)
}
const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
export type Octokit = ReturnType<typeof github.getOctokit>
export type GhContextPayload = typeof github.context.payload
;(async function main() {
  const payload = github.context.payload
  const ref = payload.ref
  if (!payload.repository) {
    throw new Error('Unable to get "repository" from payload.')
  }
  const owner = payload.repository.owner.login
  const repo = payload.repository.name

  const commits = await getCommitsFromPayload(octokit, payload)
  const files = updatedFiles(commits)
  const plantumlCodes = retrieveCodes(files)

  let tree: any[] = []
  for (const plantumlCode of plantumlCodes) {
    const p = path.format({
      dir: diagramPath === "." ? plantumlCode.dir : diagramPath,
      name: plantumlCode.name,
      ext: ".svg",
    })
    const svgPayload: GenerateSvgPayload = { code: plantumlCode.code }
    if (server) {
      svgPayload.server = server
    }
    if (username && password) {
      svgPayload.username = username
      svgPayload.password = password
    }
    const svg = await generateSvg(plantumlCode.code)
    const blobRes = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Base64.encode(svg),
      encoding: "base64",
    })

    const sha = await octokit.rest.repos
      .getContent({
        owner,
        repo,
        ref,
        path: p,
      })
      .then((res) => (<any>res.data).sha)
      .catch((e) => undefined)

    if (blobRes.data.sha !== sha) {
      tree = tree.concat({
        path: p.toString(),
        mode: "100644",
        type: "blob",
        sha: blobRes.data.sha,
      })
    }
  }

  if (tree.length === 0) {
    console.log(`There are no files to be generated.`)
    return
  }

  const treeRes = await octokit.rest.git.createTree({
    owner,
    repo,
    tree,
    base_tree: commits[commits.length - 1].commit.tree.sha,
  })

  const createdCommitRes = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    parents: [commits[commits.length - 1].sha],
    tree: treeRes.data.sha,
  })

  const updatedRefRes = await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: ref.replace(/^refs\//, ""),
    sha: createdCommitRes.data.sha,
  })

  console.log(
    `${tree.map((t) => t.path).join("\n")}\nAbove files are generated.`
  )
})().catch((e) => {
  core.setFailed(e)
})
