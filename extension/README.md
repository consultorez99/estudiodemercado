# Archivist AI — Capturador de Anuncios (extensión Chrome)

Captura anuncios del portal inmobiliario que **tú** estás viendo y los envía a tu
backend de Archivist AI. Como usa tu propia sesión de navegador (tu IP, tu
fingerprint real), los portales no la detectan como bot.

## Portales soportados
Inmuebles24, Vivanuncios, Lamudi, Casas y Terrenos, Propiedades.com.

## Instalar (modo desarrollador)
1. Abre `chrome://extensions` en Chrome/Edge/Brave.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. **Cargar descomprimida** → selecciona esta carpeta `extension/`.
4. Fija el ícono de la extensión en la barra.

## Usar
1. Levanta la app: `npm run dev` (backend en `http://localhost:3001`).
2. Navega normalmente por un portal y abre una página de resultados o de un anuncio.
3. Clic en el ícono de la extensión → **Capturar y enviar**.
   - Si la página trae datos estructurados (JSON-LD), se envían **sin gastar tokens de Gemini**.
   - Si no, se manda el texto y el backend lo estructura con la IA.
4. En la app: **AI Importer → Importar capturas**. Se deduplica y se fusiona al estudio.

## Notas
- El campo *Backend* del popup permite apuntar a otra URL (p. ej. tu despliegue).
  Si usas una URL distinta a `localhost:3001/3000`, agrégala a `host_permissions`
  en `manifest.json`.
- Sé buen ciudadano: captura las páginas que abras manualmente y respeta el ritmo
  del portal. Esto no automatiza clics masivos a propósito.
