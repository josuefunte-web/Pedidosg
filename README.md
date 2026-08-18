# O'Carro / Provea - versión fragmentada

Esta carpeta contiene tu web separada en archivos para publicarla en GitHub Pages.

## Estructura

```text
index.html
css/styles.css
js/*.js
```

El orden de los archivos JavaScript está numerado para no romper dependencias. No cambies el orden de los `<script>` en `index.html` si no estás seguro.

## Archivos principales

- `index.html`: estructura HTML y llamadas a CSS/JS.
- `css/styles.css`: todos los estilos que antes estaban dentro de `<style>`.
- `js/02-firebase-config.js`: configuración de Firebase.
- `js/03-default-data.js`: usuarios/proveedores por defecto.
- `js/07-auth.js`: login y registro.
- `js/33-escandallos.js`: módulo de escandallos.
- `js/43-init.js`: arranque de la app.

## Publicar en GitHub Pages

1. Descomprime este ZIP.
2. Entra en la carpeta `ocarro_refactorizado`.
3. Sube todo a tu repositorio de GitHub.
4. En GitHub ve a `Settings > Pages`.
5. Elige `Deploy from a branch`.
6. Selecciona `main` y `/root`.
7. Guarda.

## Si lo haces por terminal

```bash
git init
git add .
git commit -m "Version fragmentada"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

## Nota de seguridad

He conservado el comportamiento original para no romper la web. Aun así, conviene cambiar la contraseña inicial hardcodeada que aparece en el código y revisar las reglas de Firebase antes de publicar.
