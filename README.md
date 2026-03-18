# BIOTEC · Gestión de Notas

Sitio estático listo para subir a GitHub Pages o a un hosting estático.

## Qué incluye
- Vista estudiante por RUT, apellidos o correo.
- Vista profesor / UTP con login interno.
- Notas procedimentales y actitudinales por curso, asignatura y semestre.
- Observaciones por estudiante.
- Dashboard UTP con promedios y distribución.
- Accesibilidad: tema, alto contraste, tamaño de texto, narrador y buscador.
- Exportación e importación de respaldo JSON.
- Posibilidad de agregar más profesores desde la interfaz.

## Credenciales iniciales
- franciscopinto@liceosannicolas.cl / Biotec2006.
- belenacuna@liceosannicolas.cl / Biotec2006.

## Importante
Este sitio funciona completamente en frontend:
- Las notas, asignaturas y nuevos profesores se guardan en `localStorage` del navegador.
- Las credenciales no tienen protección real de servidor.
- Si quieres uso multiusuario real y sincronización entre equipos, el siguiente paso recomendado es migrar a Supabase.

## Archivos principales
- `index.html`
- `styles.css`
- `app.js`
- `data/students.json`
- `data/config.json`

## Recomendación siguiente
Puedo convertir esta misma base a:
1. Supabase Auth + base de datos real
2. Panel por asignatura y docente
3. Exportación a PDF o CSV por curso/semestre
4. Reporte institucional por estudiante
