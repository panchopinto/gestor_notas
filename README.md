# BIOTEC · Gestión de Notas v2

Sitio estático listo para subir a GitHub Pages o a cualquier hosting estático.

## Incluye
- Vista estudiante por RUT, apellido, correo o curso.
- Vista profesor / UTP con login.
- Prueba 1 a Prueba 5 por curso + semestre + asignatura.
- Configuración de:
  - ponderación %
  - exigencia %
  - puntaje total
  - puntaje de aprobación calculado automáticamente
- Registro de puntaje por estudiante en cada prueba.
- Cálculo automático de nota chilena 1.0 a 7.0.
- Nota procedimental.
- Nota actitudinal.
- Promedio académico ponderado.
- Promedio integral.
- Observaciones.
- Dashboard UTP.
- Accesibilidad con engranaje.
- Respaldo / importación JSON.
- Alta local de más profesores.
- Carpeta `supabase/` con esquema base para la migración real multiusuario.

## Credenciales iniciales
- franciscopinto@liceosannicolas.cl / Biotec2006.
- belenacuna@liceosannicolas.cl / Biotec2006.

## Importante
Esta versión guarda datos en `localStorage` del navegador.  
Sirve bien como versión interna inicial y privada, pero no sincroniza datos entre equipos.

## Siguiente paso recomendado
Migrar a Supabase usando los archivos de la carpeta `supabase/` para:
- autenticación real
- perfiles por rol
- notas compartidas entre distintos profesores
- resguardo persistente en la nube
