import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { LessonPage } from './pages/LessonPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'leccion/:slug', element: <LessonPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
