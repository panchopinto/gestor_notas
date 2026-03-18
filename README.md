# BIOTEC · Portal de notas con Supabase

Versión estática lista para publicar en GitHub Pages y conectar a una base real en Supabase.

## Qué incluye

- Vista estudiante con búsqueda por RUT, apellidos, correo y curso.
- Vista profesor / UTP con login por correo y contraseña.
- Prueba 1 a Prueba 5 por curso, asignatura y semestre.
- Configuración por evaluación de:
  - ponderación %
  - exigencia %
  - puntaje total
  - puntaje de aprobación calculado
- Cálculo automático de nota 1.0 a 7.0.
- Nota procedimental.
- Nota actitudinal.
- Observaciones por estudiante.
- Dashboard UTP con promedio del bloque y distribución.
- Accesibilidad con engranaje.
- Base inicial de estudiantes 2026 generada desde `Nomina_Oficial_2026_SAE_BIOTEC.xlsx`.

## Archivos importantes

- `index.html`: interfaz principal.
- `app.js`: lógica cliente y conexión con Supabase.
- `supabase-config.example.js`: ejemplo de configuración.
- `supabase-config.js`: archivo real que debes completar antes de publicar.
- `supabase/schema.sql`: estructura completa de la base.
- `supabase/seed_catalog.sql`: cursos, asignaturas y relaciones curso-asignatura.
- `supabase/seed_students.sql`: estudiantes y matrículas 2026.
- `supabase/bootstrap_roles.sql`: promoción de Francisco y Belén a rol docente.

## Conexión rápida

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor y ejecuta:
   - `supabase/schema.sql`
   - `supabase/seed_catalog.sql`
   - `supabase/seed_students.sql`
3. En Authentication > Users crea:
   - `franciscopinto@liceosannicolas.cl` con contraseña `Biotec2006.`
   - `belenacuna@liceosannicolas.cl` con contraseña `Biotec2006.`
4. Ejecuta `supabase/bootstrap_roles.sql`.
5. Copia `supabase-config.example.js` como `supabase-config.js`.
6. Rellena:
   - `window.SUPABASE_URL`
   - `window.SUPABASE_ANON_KEY`
7. Sube el contenido del proyecto a GitHub Pages.

## Observación importante

La vista estudiante está implementada con funciones SQL de consulta (`student_search` y `student_full_report`) pensadas para uso interno. Para una versión institucional más cerrada, el siguiente paso recomendable es dar cuentas reales a los estudiantes y restringir el acceso por Auth + RLS.

## Datos cargados

- Estudiantes semilla: 1741
- Cursos detectados: 65
- Asignaturas base: 10

## Asignaturas base incluidas

- Lenguaje y Literatura
- Matemática
- Ciencias Naturales
- Historia, Geografía y Cs. Sociales
- Inglés
- Tecnología
- Artes Visuales
- Música
- Educación Física y Salud
- Orientación

## Notas sobre la fórmula

La conversión usada deja:
- 1.0 en 0%
- 4.0 exactamente en el porcentaje de exigencia
- 7.0 en 100%

Esto se resuelve en la función SQL `public.grade_from_points()` y también se refleja en la interfaz.

