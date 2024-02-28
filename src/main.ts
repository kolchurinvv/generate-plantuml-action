// TODO logging.
import * as core from "@actions/core"
import * as github from "@actions/github"
import axios from "axios"
import { Base64 } from "js-base64"
import path from "path"
import * as plantumlEncoder from "plantuml-encoder"

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
  let url = `http://www.plantuml.com/plantuml/svg/${encoded}`
  let headers = {}

  if (payload.server) {
    url = `${payload.server}/svg/${encoded}`

    if (payload.username && payload.password) {
      const basicAuth = Base64.encode(`${payload.username}:${payload.password}`)
      headers["Authorization"] = `Basic ${basicAuth}`
    }
  }
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    })

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`)
    }

    return await response.text()
  } catch (e) {
    console.error("Failed to fetch SVG:", e)
    throw e
  }
}

if (!process.env.GITHUB_TOKEN) {
  core.setFailed("Please set GITHUB_TOKEN env var.")
  process.exit(1)
}
const isDev = process.env.DEV === "true"
const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
export type Octokit = ReturnType<typeof github.getOctokit>
export type GhContextPayload = typeof github.context.payload
;(async function main() {
  let payload
  let ref
  payload = github.context.payload
  ref = payload.ref
  let owner: string
  let repo: string

  if (!payload.repository && !isDev) {
    throw new Error('Unable to get "repository" from payload.')
  }

  owner = payload?.repository?.owner?.login
  repo = payload?.repository?.name
  if (isDev) {
    owner = "kolchurinvv"
    repo = "generate-plantuml-action"
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    })

    const branch = repoData.default_branch
    const { data: commitsData } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: branch,
    })
    ref = `refs/heads/${branch}`
    payload = {
      ref: `refs/heads/${branch}`,
      repository: {
        owner: {
          login: owner,
        },
        name: repo,
      },
      commits: commitsData.map((commit) => ({ id: commit.sha })),
    }
  }

  const commits = await getCommitsFromPayload(octokit, payload)
  let files
  if (!isDev) {
    files = updatedFiles(commits)
  } else {
    files = ["__tests__/assets/test6.puml"]
  }
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
    if (isDev) {
      svgPayload.server = process.env.SERVER
      svgPayload.username = process.env.SERVER_USERNAME
      svgPayload.password = process.env.PASSWORD
    }
    const svg = await generateSvg(svgPayload)
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

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: ref.replace(/^refs\//, ""),
    sha: createdCommitRes.data.sha,
    force: isDev,
  })

  console.log(
    `${tree.map((t) => t.path).join("\n")}\nAbove files are generated.`
  )
})().catch((e) => {
  core.setFailed(e)
})
