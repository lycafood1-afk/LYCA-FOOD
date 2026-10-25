import { createBrowserRouter, Navigate } from "react-router"
import { Layout } from "./components"
import { AboutPage, ApplicationsPage, EnquiryPage, HomePage, LegalPage, NetworkPage, NotFound, ProductsPage } from "./pages"
import {IngredientDetailsPage} from './ingredientDetails'

export const router = createBrowserRouter([{ Component: Layout, children: [
  { path: "/", Component: HomePage },
  { path: "/landing", element: <Navigate to="/" replace /> },
  { path: "/home", element: <Navigate to="/" replace /> },
  { path: "/products", Component: ProductsPage },
  { path: "/ingredients/:id", Component: IngredientDetailsPage },
  { path: "/applications", Component: ApplicationsPage },
  { path: "/about", Component: AboutPage },
  { path: "/network", Component: NetworkPage },
  { path: "/enquiry", Component: EnquiryPage },
  { path: "/privacy", element: <LegalPage type="privacy" /> },
  { path: "/terms", element: <LegalPage type="terms" /> },
  { path: "*", Component: NotFound },
]}],{basename:import.meta.env.VITE_ROUTER_BASENAME||'/'})
