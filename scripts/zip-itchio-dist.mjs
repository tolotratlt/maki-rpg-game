import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const workspaceRoot = process.cwd()
const distDir = path.join(workspaceRoot, 'dist-itchio')
const zipPath = path.join(workspaceRoot, 'dist-itchio.zip')

function runPowershell(command) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            'powershell',
            ['-NoProfile', '-Command', command],
            { stdio: 'inherit', cwd: workspaceRoot }
        )

        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`PowerShell exited with code ${code}`))
        })
    })
}

function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', cwd })
        child.on('error', reject)
        child.on('close', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${command} exited with code ${code}`))
        })
    })
}

async function main() {
    await fs.access(distDir)
    await fs.rm(zipPath, { force: true })

    try {
        await runCommand('tar', ['-a', '-c', '-f', zipPath, '-C', distDir, '.'], workspaceRoot)
    } catch (error) {
        const fallbackCommand = [
            "if (-not (Test-Path -LiteralPath 'dist-itchio')) { throw 'dist-itchio folder not found' }",
            "Compress-Archive -Path 'dist-itchio\\*' -DestinationPath 'dist-itchio.zip' -Force"
        ].join('; ')
        await runPowershell(fallbackCommand)
    }

    console.log('Created dist-itchio.zip')
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
