# Contributing to Ariadne

Ariadne es un Hub local de gobernanza multiproyecto. Nos encantaría tu ayuda reportando bugs y mejoras.

## 🐛 Reportar Bugs

Si encuentras un bug mientras usas Ariadne:

1. **Abre una issue en GitHub**: https://github.com/mincho77/Ariadne/issues/new
2. **Incluye**:
   - Descripción clara del problema
   - Pasos para reproducirlo
   - Versión de Node.js (`node --version`)
   - Versión de npm (`npm --version`)
   - Stack trace si hay error
   - Sistema operativo

**Ejemplo:**
```
Title: Gantt scheduler shifts dates backward by 1 day in timezone -5

Description:
When I set not_before=2026-08-11 on a task, the Gantt scheduler places it on 2026-08-10 instead.
Happens on all tasks with date-only YAML fields.

Environment:
- Node 20.10.0
- macOS 14.1
- Timezone: America/Bogota (UTC-5)
```

## 💡 Sugerir Mejoras

¿Tienes una idea? Abre una issue con el tag `enhancement`:
https://github.com/mincho77/Ariadne/issues/new?labels=enhancement

## 📝 Crear Pull Requests

**Este repo es usado en producción.** Los cambios directos al `master` no se aceptan.

Para contribuir código:

1. **Fork** el repositorio
2. **Crea una rama**: `git checkout -b fix/mi-bug` o `git checkout -b feature/mi-mejora`
3. **Haz cambios y testa**: `npm test`
4. **Push a tu fork**: `git push origin fix/mi-bug`
5. **Abre un Pull Request** describiendo:
   - Qué problema resuelve
   - Cómo se testea
   - Breaking changes (si los hay)

**Requisitos para PRs:**
- ✅ Todos los tests deben pasar (`npm test`)
- ✅ Sin errores de linting
- ✅ Documentación actualizada si aplica
- ✅ Mensaje de commit descriptivo

## 🚀 Desarrollar Localmente

```bash
# Clone tu fork
git clone https://github.com/tu-usuario/Ariadne.git
cd Ariadne

# Instala dependencias
npm install

# Corre los tests
npm test

# Inicia el servidor localmente
npm start
# Hub: http://127.0.0.1:4177
```

## 📋 Proceso de Review

1. El mantenedor revisa tu PR
2. Puede pedir cambios o aclaraciones
3. Una vez aprobado, se integra a `master`
4. Se publica en la siguiente release

## 🔒 Ramas Protegidas

- **`master`**: Rama principal, protegida. Requiere review.
- **`develop`**: Rama de desarrollo (si existe). Puedes trabajar aquí.

## 📦 Versiones

Las versiones siguen [Semantic Versioning](https://semver.org):
- **MAJOR**: Breaking changes (API changes, incompatibilities)
- **MINOR**: Features nuevas (backward-compatible)
- **PATCH**: Bug fixes

Versión actual: Revisa `package.json`

## ❓ Preguntas

¿Dudas sobre cómo contribuir?
- Abre una discussion: https://github.com/mincho77/Ariadne/discussions
- O reporta un issue: https://github.com/mincho77/Ariadne/issues

---

**¡Gracias por ayudar a mejorar Ariadne!** 🙌
