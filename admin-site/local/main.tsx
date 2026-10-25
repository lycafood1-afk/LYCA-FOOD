import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/manrope';
import '../app/globals.css';
import {IngredientStudio} from '../components/lyca/ingredient-studio';

createRoot(document.getElementById('root')!).render(<React.StrictMode><IngredientStudio/></React.StrictMode>);
