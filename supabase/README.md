# Migración recomendada a Supabase

## Qué falta para convertirlo a versión real
1. Crear proyecto en Supabase.
2. Ejecutar `schema.sql`.
3. Importar la nómina a la tabla `students`.
4. Crear usuarios docentes en Auth.
5. Generar sus perfiles en `profiles` con rol `teacher`, `admin` o `utp`.
6. Reemplazar `data/config.json` por credenciales reales y cambiar `mode` a `supabase`.
7. Adaptar `app.js` para leer/escribir desde Supabase en lugar de `localStorage`.

## Recomendación técnica
Para no exponer claves en un repo público, usar:
- GitHub privado, o
- Vercel / Netlify con variables de entorno y función edge/serverless.

## Observación
Aunque el link hoy sea privado y de uso interno, la clave anónima de Supabase y la estructura de la app igual deben manejarse con cuidado.
