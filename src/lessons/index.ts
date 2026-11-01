import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { MODULES } from './modules'
import type { LessonMeta } from './types'

/* Cada lección vive en src/lessons/<slug>/ con:
     meta.ts   → export const meta: LessonMeta
     index.tsx → export default function Lesson() {...}
   Se registran solas por glob. */

const metaFiles = import.meta.glob<{ meta: LessonMeta }>('./*/meta.ts', { eager: true })
const componentFiles = import.meta.glob<{ default: ComponentType }>('./*/index.tsx')

const moduleOrder = (m: LessonMeta['module']) => MODULES.findIndex((x) => x.id === m)

export const LESSONS: LessonMeta[] = Object.values(metaFiles)
  .map((f) => f.meta)
  .sort((a, b) => moduleOrder(a.module) - moduleOrder(b.module) || a.order - b.order)

export const lessonsByModule = (id: LessonMeta['module']) => LESSONS.filter((l) => l.module === id)
export const getLesson = (slug: string) => LESSONS.find((l) => l.slug === slug)
export const lessonNumber = (slug: string) => LESSONS.findIndex((l) => l.slug === slug) + 1

const cache = new Map<string, LazyExoticComponent<ComponentType>>()
export function lessonComponent(slug: string) {
  const loader = componentFiles[`./${slug}/index.tsx`]
  if (!loader) return null
  if (!cache.has(slug)) cache.set(slug, lazy(loader))
  return cache.get(slug)!
}
