import { ChevronRightIcon, FileVideoIcon, FolderIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { HardlinkInfo } from '@/components/HardlinkInfo'
import { StateBadge } from '@/components/StateBadge'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/lib/i18n'
import { formatBytes } from '@/lib/library-filters'
import { cn } from '@/lib/utils'

export interface TreeFileEntry {
  disk_id?: number
  relative_path: string
  state: string
  excluded: boolean
  linked_paths: string[]
  size_bytes: number
}

export interface TreeNode {
  name: string
  path: string
  file: TreeFileEntry | null
  children: Map<string, TreeNode>
  // Aggregati ricorsivi: per una cartella la somma dei file sottostanti,
  // per un file i suoi soli valori.
  sizeBytes: number
  fileCount: number
}

function emptyNode(name: string, path: string): TreeNode {
  return { name, path, file: null, children: new Map(), sizeBytes: 0, fileCount: 0 }
}

export function buildTree(files: TreeFileEntry[]): TreeNode {
  const root = emptyNode('', '')
  for (const file of files) {
    const segments = file.relative_path.split('/')
    let node = root
    node.sizeBytes += file.size_bytes
    node.fileCount += 1
    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1
      const path = segments.slice(0, i + 1).join('/')
      let child = node.children.get(segment)
      if (!child) {
        child = emptyNode(segment, path)
        node.children.set(segment, child)
      }
      child.sizeBytes += file.size_bytes
      child.fileCount += 1
      if (isLast) child.file = file
      node = child
    })
  }
  return root
}

// Cartelle prima dei file, poi alfabetico.
function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    if (!!a.file !== !!b.file) return a.file ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

interface FlatRow {
  node: TreeNode
  depth: number
  open: boolean
}

export function FileTree({ files, expandAll = false }: { files: TreeFileEntry[]; expandAll?: boolean }) {
  // Cartelle il cui stato aperto/chiuso differisce dal default (aperte al
  // primo livello, chiuse sotto) — così il default resta quello anche
  // quando i dati cambiano, senza dover pre-popolare un Set di path.
  const [toggled, setToggled] = useState<Set<string>>(() => new Set())
  const tree = useMemo(() => buildTree(files), [files])

  const rows = useMemo(() => {
    const out: FlatRow[] = []
    const walk = (node: TreeNode, depth: number) => {
      for (const child of sortedChildren(node)) {
        const open = !child.file && (expandAll || (depth < 1) !== toggled.has(child.path))
        out.push({ node: child, depth, open })
        if (open) walk(child, depth + 1)
      }
    }
    walk(tree, 0)
    return out
  }, [tree, toggled, expandAll])

  const toggle = (path: string) =>
    setToggled((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  if (files.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('library.noFilesMatchFilters')}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('library.columnName')}</TableHead>
          <TableHead className="w-28 text-right">{t('library.columnSize')}</TableHead>
          <TableHead className="w-48">{t('library.columnState')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ node, depth, open }) => {
          const indent = { paddingLeft: `${depth * 1.25 + 0.5}rem` }
          if (!node.file) {
            return (
              <TableRow
                key={node.path}
                className="cursor-pointer"
                aria-expanded={open}
                onClick={() => toggle(node.path)}
              >
                <TableCell className="max-w-0" style={indent}>
                  <div className="flex items-center gap-1.5">
                    <ChevronRightIcon
                      className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
                    />
                    <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{node.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('library.filesCount', { count: node.fileCount })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {formatBytes(node.sizeBytes)}
                </TableCell>
                <TableCell />
              </TableRow>
            )
          }
          const file = node.file
          return (
            <TableRow key={node.path} className={cn(file.excluded && 'opacity-60')}>
              <TableCell className="max-w-0" style={indent}>
                <div className="flex items-center gap-1.5 pl-5">
                  <FileVideoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs" title={file.relative_path}>
                    {node.name}
                  </span>
                  <HardlinkInfo linkedPaths={file.linked_paths} />
                </div>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatBytes(file.size_bytes)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <StateBadge state={file.state} />
                  {file.excluded && (
                    <Badge variant="outline" className="text-[10px]">
                      {t('library.excluded')}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
