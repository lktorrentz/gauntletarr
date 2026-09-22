import { ChevronRightIcon, FolderIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { HardlinkInfo } from '@/components/HardlinkInfo'
import { StateBadge } from '@/components/StateBadge'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface TreeFileEntry {
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
}

export function buildTree(files: TreeFileEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', file: null, children: new Map() }
  for (const file of files) {
    const segments = file.relative_path.split('/')
    let node = root
    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1
      const path = segments.slice(0, i + 1).join('/')
      let child = node.children.get(segment)
      if (!child) {
        child = { name: segment, path, file: null, children: new Map() }
        node.children.set(segment, child)
      }
      if (isLast) child.file = file
      node = child
    })
  }
  return root
}

function FolderRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1)
  const children = [...node.children.values()].sort((a, b) => {
    if (!!a.file !== !!b.file) return a.file ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
        style={{ paddingLeft: `${depth * 1.25 + 0.375}rem` }}
      >
        <ChevronRightIcon className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children.map((child) =>
          child.file ? (
            <FileRow key={child.path} node={child} depth={depth + 1} />
          ) : (
            <FolderRow key={child.path} node={child} depth={depth + 1} />
          ),
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function FileRow({ node, depth }: { node: TreeNode; depth: number }) {
  const file = node.file!
  return (
    <div
      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-muted"
      style={{ paddingLeft: `${depth * 1.25 + 1.5}rem` }}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{node.name}</span>
      <HardlinkInfo linkedPaths={file.linked_paths} />
      {file.excluded && <Badge variant="outline" className="text-[10px]">{t('library.excluded')}</Badge>}
      <StateBadge state={file.state} />
    </div>
  )
}

export function FileTree({
  files,
  statusFilter,
  showExcluded,
}: {
  files: TreeFileEntry[]
  statusFilter: 'all' | 'seeding' | 'problem'
  showExcluded: boolean
}) {
  const filtered = useMemo(
    () =>
      files.filter((f) => {
        if (!showExcluded && f.excluded) return false
        if (statusFilter === 'seeding') return f.state === 'seeding'
        if (statusFilter === 'problem') return f.state !== 'seeding'
        return true
      }),
    [files, statusFilter, showExcluded],
  )

  const tree = useMemo(() => buildTree(filtered), [filtered])
  const topLevel = [...tree.children.values()].sort((a, b) => {
    if (!!a.file !== !!b.file) return a.file ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('library.noFilesMatchFilters')}</p>
  }

  return (
    <div className="grid">
      {topLevel.map((node) =>
        node.file ? (
          <FileRow key={node.path} node={node} depth={0} />
        ) : (
          <FolderRow key={node.path} node={node} depth={0} />
        ),
      )}
    </div>
  )
}
