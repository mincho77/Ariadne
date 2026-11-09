# Instalar Ariadne

Ariadne funciona en macOS, Windows y Linux. Tus proyectos permanecen en tu computador; al registrarlos, Ariadne guarda sus rutas en un catálogo local.

## Requisitos

- Git
- Node.js 18 o posterior, con npm
- La carpeta de un proyecto existente que quieras registrar

## Instalar desde GitHub

Abre Terminal, PowerShell o la terminal de Linux y ejecuta:

```bash
git clone https://github.com/mincho77/Ariadne.git
cd Ariadne
npm install
npm run setup
```

El asistente verifica Node y las dependencias de Ariadne. Luego te pide la ruta completa de tu proyecto y el nombre que quieres mostrar. Agrega la ruta a `projects.json` y no cambia los archivos del proyecto. El catálogo es local y Git lo excluye.

Inicia Ariadne:

```bash
npm start
```

Abre <http://127.0.0.1:4177/> en el navegador. Mantén abierta la terminal mientras uses el Hub. Para detener Ariadne, presiona `Ctrl+C`.

## Revisar o corregir la instalación

```bash
npm run doctor
```

El doctor revisa Node, las dependencias, el catálogo local, las carpetas registradas y la respuesta del Hub. Muestra un paso concreto para corregir cada problema.

## Iniciar Ariadne automáticamente (opcional)

El asistente puede instalar un servicio para tu cuenta. También puedes administrarlo después:

```bash
npm run autostart -- install
npm run autostart -- status
npm run autostart -- uninstall
```

Usa LaunchAgent en macOS, una entrada de Inicio en Windows o un servicio `systemd --user` en Linux. No requiere permisos de administrador. En Linux sin un administrador systemd de usuario activo, usa `npm start`.

## Usar con npx

El ejecutable y la estructura del paquete están preparados con el nombre candidato `ariadne-hub`. Cuando se publique el paquete, podrás usar:

```bash
npx ariadne-hub setup
npx ariadne-hub start
```

El paquete npm aún no está publicado. Por ahora, la forma soportada de instalar esta versión es desde GitHub. Antes del primer lanzamiento se debe confirmar el nombre npm y la cuenta propietaria.

`npx` usa una caché temporal y por eso setup no instala el inicio automático en esa modalidad. Para mantener Ariadne disponible entre sesiones, usa la instalación desde GitHub o instala el paquete publicado globalmente y después ejecuta `ariadne-hub setup` y `ariadne-hub autostart install`.

## Solución de problemas

- **Falta Node.js o es una versión antigua:** instala Node.js 18 o posterior, cierra y vuelve a abrir la terminal, ejecuta `node --version` y después `npm run doctor`.
- **No aparece la carpeta del proyecto:** vuelve a ejecutar `npm run setup` e ingresa la ruta completa. Se admiten rutas con espacios.
- **No abre el Hub:** ejecuta `npm run doctor`. Si otra aplicación usa el puerto `4177`, ciérrala o cambia el puerto antes de iniciar Ariadne.
- **Moviste una carpeta ya registrada:** actualiza o elimina la entrada correspondiente en el catálogo local `projects.json`, después de crear una copia de seguridad.
- **El catálogo no es JSON válido:** setup y doctor no lo modifican. Haz una copia de seguridad, corrige la sintaxis y vuelve a ejecutar `npm run doctor`.

## Privacidad

El catálogo contiene rutas locales y no se sube a Git. Setup solo registra la ruta; no copia ni modifica los archivos del proyecto. Tampoco contacta a JEV ni a otro proveedor de modelos.
