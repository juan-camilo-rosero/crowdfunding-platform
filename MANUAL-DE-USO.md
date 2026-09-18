# Manual de uso — Investors 180

Para las personas que administran la plataforma.

Este manual explica qué hace cada pantalla y cómo funciona cada proceso. No requiere conocimientos técnicos. La instalación, las variables de configuración y el despliegue están en el manual técnico.

---

## Índice

1. [Cómo está organizado el sistema](#1-cómo-está-organizado-el-sistema)
2. [Entrar por primera vez](#2-entrar-por-primera-vez)
3. [El panel de administrador: cómo se editan los datos](#3-el-panel-de-administrador-cómo-se-editan-los-datos)
4. [Las tablas del panel, una por una](#4-las-tablas-del-panel-una-por-una)
5. [Usuarios](#5-usuarios)
6. [Embudo de ventas](#6-embudo-de-ventas)
7. [Lo que ve el inversionista](#7-lo-que-ve-el-inversionista)
8. [Los procesos completos](#8-los-procesos-completos)
9. [Reglas que el sistema no deja romper](#9-reglas-que-el-sistema-no-deja-romper)
10. [Lo que hoy no se puede hacer](#10-lo-que-hoy-no-se-puede-hacer)

---

## 1. Cómo está organizado el sistema

La plataforma tiene dos mundos:

- **El portal del inversionista.** Donde cada persona consulta sus inversiones, sus movimientos y sus documentos.
- **El panel de administrador.** Donde el equipo carga y corrige toda la información.

Lo que ves en el panel es lo que verán los inversionistas. No hay un paso de publicación: guardas y queda visible.

### Dos capacidades independientes

Una cuenta puede tener dos cosas, por separado:

| Capacidad | Qué significa | De dónde sale |
|---|---|---|
| **Inversionista** | Tiene dinero invertido y ve sus pantallas | Existe una ficha suya en la tabla Inversionistas |
| **Administrador** | Puede entrar al panel | Se le asigna el rol de admin |

No son excluyentes. **La misma persona puede ser las dos cosas** — es el caso de la dueña, que gestiona el negocio y además invirtió en él. Ella ve las dos secciones en el menú.

Tres reglas resumen todo:

- El **administrador ve todo**: su panel y las pantallas de inversionista.
- El **inversionista ve todo menos el panel**.
- El **visitante** (nadie más) ve solo el catálogo de proyectos y su perfil.

Alguien con inversiones **no** entra al panel por tenerlas. Esa barrera nunca se relaja.

### Estados de una cuenta

El estado dice si la persona puede entrar, no si es inversionista.

| Estado | Puede iniciar sesión |
|---|---|
| Invitado (pre-registrado, aún no entra) | No |
| Registrado (ya entró con su correo) | Sí |
| Activo | Sí |
| Suspendido | No |
| Desactivado (baja, conserva historial) | No |

---

## 2. Entrar por primera vez

Se entra en `/login` con correo y contraseña, o con Google.

Después del ingreso el sistema decide a dónde llevar a cada quien:

| Situación | A dónde llega |
|---|---|
| No ha completado sus datos personales | A completarlos |
| Es inversionista (con o sin admin) | A Inicio |
| Es admin sin inversiones | Al panel |
| No es ninguna de las dos | Al catálogo |

Si eres admin **y** tienes inversiones, entras a Inicio y saltas al panel desde el menú lateral.

### El menú lateral

Se arma según tus capacidades. Un administrador con inversiones ve:

**Sección de inversionista:** Inicio · Portafolio · Mis inversiones · Transacciones · Documentos · Solicitudes

**Sección Admin:** Panel de administrador · Usuarios · Embudo de ventas

Un administrador sin inversiones ve las mismas pestañas; las de inversionista le saldrán vacías, y eso es correcto.

---

## 3. El panel de administrador: cómo se editan los datos

Esta mecánica es igual en las nueve tablas. Se aprende una vez.

### Editar una celda

1. Haz **doble clic** en la celda que quieras cambiar (o selecciónala con el tabulador y pulsa Enter) y escribe. Las celdas de lista abren con un solo clic.
2. Sal de la celda: el cambio se guarda solo, en menos de un segundo.
3. Debajo de la tabla verás **"Guardando…"** y luego **"Todos los cambios están guardados"**.

**Los cambios se guardan automáticamente.** Ya no hay que pulsar ningún botón, y cambiar de pestaña o de filtro no pierde nada: lo pendiente se guarda antes de moverse.

Si algo falla, el mensaje aparece debajo de la tabla, la fila queda marcada en rojo, **tu texto se queda en pantalla** y tienes un botón **Reintentar**.

### La primera columna tiene dos líneas

En **Proyectos** y en **Inversionistas** (también en el embudo de ventas), la primera columna muestra el nombre y, debajo, lo que lo distingue: la ciudad y el tipo del proyecto, o el correo del inversionista. Esa columna queda fija al desplazarte hacia la derecha, así siempre sabes en qué registro estás.

- Al editarla, solo se edita el **nombre**; la línea de abajo sigue visible mientras escribes.
- La línea de abajo no se edita ahí: sale de las columnas Ciudad, Tipo o Correo, y se actualiza sola en cuanto cambias alguna de ellas.

### Editar la fila completa

Cada fila tiene un botón **Editar** a la derecha. Abre un formulario con todos los campos del registro, con sus nombres y su tipo, sin tener que recorrer la fila de izquierda a derecha. Es la forma cómoda de corregir varias cosas a la vez.

### Todo o nada

Cada guardado entra completo o no entra. Si una celda tiene un error, verás el mensaje y **nada de ese guardado se aplicó**. Corriges y se vuelve a intentar.

Los mensajes dicen exactamente qué campo está mal y por qué:

> El teléfono en 'Teléfono' debe incluir el indicativo del país (ejemplo: +573001112233).

### Agregar registros

Pulsa **Nuevo registro**, arriba a la derecha de la tabla. Se abre un formulario con todos los campos; los obligatorios llevan un asterisco. Al confirmar, el registro aparece en la tabla.

La única tabla que **no** permite agregar es *Interés de inversión*: esas filas las crean los propios usuarios desde el catálogo.

### Filtrar

Sobre cada tabla hay filtros por sus campos de lista (estado, ciudad, proyecto, etapa…), los mismos que usa el catálogo. El contador dice cuántos registros estás viendo. **Limpiar filtros** los quita todos.

Los filtros quedan en la dirección del navegador, así que puedes guardar la vista en favoritos o compartirla.

### Campos que no se pueden editar

Algunos aparecen bloqueados a propósito:

- **Los que se calculan.** Capital recibido, pendiente y diferencias salen de sumar las otras tablas. Escribirlos a mano los pondría en desacuerdo con la realidad.
- **El estado de una solicitud de reasignación.** Ver el [límite conocido](#10-lo-que-hoy-no-se-puede-hacer).

### Cambiar entre tablas

Las nueve tablas viven en la misma pantalla, en pestañas. Se cargan las primeras 100 filas de cada una, siempre en el mismo orden.

Las tablas son más anchas que la pantalla: usa la **barra de desplazamiento horizontal** que aparece bajo la tabla. La primera columna se queda fija para que nunca pierdas de vista de qué registro es cada fila.

---

## 4. Las tablas del panel, una por una

### Proyectos

El corazón del sistema. Cada fila es un inmueble.

Lo que más importa:

- **Estado**: en evaluación, en reserva, permisos, construcción, vendido, rentado, pausado. Define el color con que se muestra el proyecto en todo el portal.
- **Avance**: número entero de 0 a 100. Es la barra que ve el inversionista.
- **En captación** y **meta de captación**: es un interruptor (Sí/No) que se cambia con **un solo clic** y se guarda al instante. Encendido, el proyecto muestra una barra de recaudo y el botón "Me interesa" en el catálogo.
- **Descripción** y **argumentos de venta**: el texto que lee alguien evaluando invertir.
- **Retorno ofrecido**: ya no es texto libre. Con el lápiz se abre un editor donde eliges cómo ofrece retorno el proyecto:
  - **Tasa anual**: una o varias filas de plazo (meses) con tasa mínima y máxima. Si la tasa es fija, deja el máximo vacío.
  - **Total al cierre**: un porcentaje total sobre el capital y, si lo sabes, el plazo estimado.
  - **Participación**: el porcentaje de las utilidades del proyecto.
  - **Sin publicar**: el proyecto no muestra retorno ni calculadora.

  Abajo ves **exactamente cómo se verá en el catálogo** (por ejemplo "10%–15% anual · 6 a 18 meses"), o qué hay que corregir. Con esto funciona la **calculadora de la página del proyecto**: usa las tasas y plazos reales que configures. Con participación no se calcula un monto (depende de la utilidad final); se muestra una explicación. Sin retorno configurado, no aparece calculadora.

  Los proyectos que tenían un texto anterior lo siguen mostrando en gris ("Texto anterior: …") hasta que configures el nuevo; al guardarlo, el texto anterior se reemplaza.

#### Fotos

En la columna **Fotos** de cada proyecto hay un botón que abre la galería. También puedes abrirla desde la propia página del proyecto en el catálogo (ver abajo).

- **La primera foto es la portada** del catálogo. Puedes cambiar cuál es con "Usar como portada".
- Formatos: JPG, PNG, WebP, AVIF o HEIC (las fotos de iPhone se convierten solas cuando el navegador puede leerlas).
- **Las fotos se optimizan antes de subirse**: una foto de celular de 15 MB queda en 1–2 MB sin diferencia visible en la galería. Verás "Optimizando imagen 2 de 5…" y luego "Subiendo imagen 2 de 5…". Al terminar, un aviso dice cuánto se ahorró.
- Las fotos que ya son livianas no se tocan.
- Si una imagen falla, el mensaje dice **cuál** y **por qué** (conexión, sesión expirada, tamaño), y las que ya subieron quedan guardadas y visibles. La ventana se puede cerrar en cualquier momento.
- Se ven en el catálogo y en la galería del proyecto.

#### Editar un proyecto desde el catálogo

No hace falta venir al panel para corregir un proyecto. Entra al catálogo, abre el proyecto y, **si eres administrador**, sobre la galería verás dos botones:

- **Editar información**: abre el mismo formulario con todos los campos del proyecto.
- **Editar fotos**: abre la galería de arriba.

Nadie más ve esos botones, y aunque alguien intentara usarlos por su cuenta, el servidor vuelve a comprobar que sea administrador antes de escribir nada.

### Inversionistas

Una ficha por persona. Datos de contacto, monto potencial, etapa del embudo y estado.

Esta tabla es la que decide quién es inversionista. **Si una fila aquí está conectada a una cuenta, esa persona ve las pantallas de inversionista.** La conexión se hace desde [Usuarios](#5-usuarios), no aquí.

Puedes crear fichas de gente que todavía no tiene cuenta. Es lo normal cuando el contacto viene antes del registro.

### Capital y financiamiento

Los aportes. Una fila por cada compromiso de capital de un inversionista en un proyecto.

- **Monto requerido / comprometido / recibido**: son tres cosas distintas. Recibido es lo que efectivamente entró.
- **Retorno pactado**: texto libre — "15% anual", "Participación 8%". El sistema **no lo interpreta ni lo promedia**; lo muestra tal cual.
- **Estado**: pendiente, recibido, usado, devuelto.

De esta tabla salen las cifras que ve el inversionista en su Inicio.

### Presupuesto

Gastos por proyecto, con categoría, presupuesto aprobado y gasto real. La diferencia se calcula sola.

### Timeline

Las tareas del proyecto: etapa, responsable, fechas, prioridad y estado. Alimenta el cronograma que ve el inversionista en la pestaña Avance de cada proyecto.

### Reportes

Los reportes mensuales por proyecto: avance físico, avance financiero, fotos, decisiones, riesgos y próximos pasos.

Es la pestaña con más peso para el inversionista. Es donde ve que su proyecto está vivo.

### Documentos

Todos los archivos del sistema. El campo decisivo es **Visibilidad**:

| Visibilidad | Quién lo ve |
|---|---|
| **Privado** | Solo el inversionista indicado en la fila |
| **Proyecto** | Solo quienes tienen capital en ese proyecto |
| **Público** | Cualquier usuario con cuenta |

Si marcas un documento como privado, **es obligatorio indicar de qué inversionista es**. Sin eso, no lo verá nadie.

### Solicitudes

Las peticiones de los inversionistas para mover capital de un proyecto a otro. Ver el [límite conocido](#10-lo-que-hoy-no-se-puede-hacer) sobre aprobarlas.

### Interés de inversión

Los formularios "Me interesa este proyecto" que envían los usuarios desde el catálogo.

No se pueden crear a mano: llegan solos. Lo que sí puedes es cambiar el **estado** — nuevo, contactado, cerrado — para llevar el seguimiento.

Si el correo está configurado, también te llega un aviso cada vez que alguien envía uno.

---

## 5. Usuarios

Todas las personas con cuenta en la plataforma. Es la pantalla desde la que se convierte a alguien en inversionista.

Cada fila muestra su **estado** con etiquetas:

- **Visitante** — tiene cuenta, no tiene inversiones
- **Inversionista** — tiene ficha conectada
- **Admin** — puede entrar al panel
- **Prospecto en pipeline** — ya existe una ficha de inversionista con su mismo correo, sin conectar

Una persona puede tener dos etiquetas a la vez. Puedes buscar por nombre o correo y filtrar por estado.

### Convertir un visitante en inversionista

Botón **"Convertir en inversionista"** en su fila. Confirmas y listo.

El sistema hace una de dos cosas, según el caso:

- **Si ya existe una ficha con su correo** (la etiqueta "Prospecto en pipeline"), la **conecta** a su cuenta. No duplica nada.
- **Si no existe**, crea una ficha nueva.

Convertir a alguien **no lo hace administrador**. Son cosas distintas.

Cuando un botón no aparece, en su lugar verás la razón:

| Razón | Qué significa |
|---|---|
| Ya es inversionista | Nada que hacer |
| Onboarding pendiente | Todavía no completó sus datos personales |
| No aplica a administradores | Los admins no se convierten desde aquí |

### Enviar el contrato a firma

En la fila de alguien que **ya es inversionista** aparece **"Enviar contrato a firma"**.

1. Pulsa el botón.
2. Sube el PDF del contrato preparado para esa inversión.
3. Enviar.

La persona recibe el contrato para firmarlo electrónicamente. El proceso completo está en [Los procesos](#firma-del-contrato).

El inversionista no puede pedir su contrato por su cuenta. Siempre lo envía el equipo.

---

## 6. Embudo de ventas

La misma tabla de Inversionistas, mostrada como embudo de captación: nombre, teléfono, monto potencial y etapa.

Las etapas van: contacto → calificado → en reunión → en revisión → firmado → desembolsado.

Puedes filtrar por etapa y cambiar la etapa de cada persona. Los cambios se guardan igual que en el panel: editas y pulsas Guardar.

Es la misma información que la tabla Inversionistas, con otra vista. Lo que cambies aquí se ve allá, y al revés.

---

## 7. Lo que ve el inversionista

Conviene conocerlo, porque es la consecuencia directa de lo que cargas en el panel.

| Pantalla | Qué muestra | De dónde sale |
|---|---|---|
| **Inicio** | Cifras principales, gráfico de distribución, sus proyectos | Capital y transacciones |
| **Portafolio** | Catálogo de todos los proyectos del grupo | Proyectos |
| **Mis inversiones** | Solo los proyectos donde tiene capital | Capital |
| **Proyecto** | Fotos, resumen, avance, reportes, documentos, su inversión | Proyectos, Timeline, Reportes, Documentos |
| **Transacciones** | Sus movimientos: aportes, rendimientos, devoluciones | Transacciones |
| **Documentos** | Solo los archivos que le corresponden | Documentos |
| **Solicitudes** | Sus peticiones de mover capital | Solicitudes |
| **Perfil** | Sus datos y cerrar sesión | — |

### El asistente virtual

Hay un botón redondo abajo a la derecha que abre un chat.

Responde sobre la plataforma y sobre **los datos propios de esa persona**. No da asesoría de inversión, no promete retornos, y ante preguntas como "¿me conviene invertir?" remite al equipo.

No guarda historial: cada conversación desaparece al recargar la página.

Solo lo ven los inversionistas vinculados. Necesita estar activado en la configuración; mientras no lo esté, responde que no está disponible.

---

## 8. Los procesos completos

### Alta de un inversionista

Hay dos caminos, según quién llegue primero.

**Camino A — el equipo contacta primero:**

1. Creas su ficha en la tabla Inversionistas con su correo.
2. La persona se registra en la plataforma con **ese mismo correo**.
3. Completa sus datos personales.
4. Vas a Usuarios y pulsas "Convertir en inversionista". El sistema conecta la ficha que ya existía.

**Camino B — la persona se registra sola:**

1. Se registra y completa sus datos.
2. Aparece en Usuarios como Visitante.
3. Pulsas "Convertir en inversionista". El sistema le crea la ficha.

**La regla de oro es el correo.** La conexión se hace por correo verificado. Si escribiste un correo distinto al que la persona usa para entrar, no habrá coincidencia: corrige el correo en su ficha y vuelve a intentar.

### Activación de la cuenta: identidad y contrato

Después de convertir a alguien, le aparece un aviso en su Inicio invitándolo a activar su cuenta. Son dos pasos.

**No lo bloquea.** Puede usar el portal completo mientras tanto.

#### Paso 1 — Verificación de identidad

La persona pulsa un botón y el sistema valida su identidad. Si sale rechazada, se le explica y puede reintentar.

> Hoy este paso está **simulado**: aprueba siempre. Ver [límites](#10-lo-que-hoy-no-se-puede-hacer).

#### Paso 2 — Firma del contrato

No puede firmar antes de verificar su identidad. Es a propósito.

1. **Tú envías el contrato** desde Usuarios, subiendo el PDF.
2. La persona ve un botón para abrir el contrato y lo firma electrónicamente.
3. Mientras se registra la firma, ve un mensaje de "estamos registrando tu firma".
4. Cuando termina, **el contrato firmado aparece en su pestaña Documentos**, como documento privado suyo.

Si rechaza el contrato, o si el enlace expira, queda registrado y **tú puedes volver a enviárselo**. La persona no tiene forma de reintentarlo sola.

El aviso de su Inicio desaparece cuando ambos pasos están listos.

### Alguien muestra interés desde el catálogo

1. Un usuario abre un proyecto y pulsa "Me interesa este proyecto". El botón aparece en cualquier proyecto abierto a inversión; en los vendidos o rentados no se muestra.
2. Llena el formulario: monto (opcional), tipo de inversión preferido y comentarios.
3. La fila aparece en la tabla **Interés de inversión**, en estado "nuevo".
4. Si el correo está configurado, recibes un aviso.
5. Contactas a la persona y actualizas el estado a "contactado" y luego "cerrado".

Enviar ese formulario no compromete a nada, y así se le dice a la persona.

### Un inversionista pide mover capital

1. Desde su pantalla de Solicitudes, elige un proyecto de origen, uno de destino y un monto.
2. Solo puede mover dinero de **proyectos ya finalizados**, y como máximo el capital que tiene disponible ahí.
3. La solicitud aparece en la tabla Solicitudes en estado "pendiente".
4. La resolución se coordina fuera de la plataforma. Ver [límites](#10-lo-que-hoy-no-se-puede-hacer).

Una solicitud pendiente ya descuenta del capital disponible, para que nadie pueda pedir dos veces el mismo dinero.

---

## 9. Reglas que el sistema no deja romper

No son recomendaciones. Están impuestas por debajo, y no dependen de que la pantalla oculte un botón.

**Un inversionista nunca ve datos de otro.** Ni sus transacciones, ni sus documentos, ni sus cifras. Tampoco escribiendo la dirección a mano ni desde el asistente virtual.

**Nadie se hace administrador a sí mismo.** El rol de admin solo se asigna deliberadamente.

**Nadie se vincula solo como inversionista.** Crear o conectar la ficha es siempre acto del equipo.

**Nadie declara su propia identidad verificada ni su propio contrato firmado.** Esos estados los decide el sistema, no la persona.

**Un inversionista no aprueba sus propias solicitudes.**

**Un documento privado es privado.** Solo lo ve el inversionista al que se lo asignaste.

**Los cálculos no se escriben a mano.** Capital recibido, pendiente, diferencias y acumulados salen de las tablas.

**La plataforma no mueve dinero.** Registra y organiza solicitudes. No custodia ni transfiere nada.

---

## 10. Lo que hoy no se puede hacer

Es honesto tenerlo claro antes de empezar a operar.

**Aprobar una solicitud de reasignación desde el panel.** La columna Estado está bloqueada a propósito: aprobar debe generar además la transacción correspondiente, y esa pantalla todavía no está construida. Hoy las solicitudes se ven y se coordinan por fuera.

**La verificación de identidad está simulada.** El paso funciona de principio a fin, pero aprueba siempre. Conectar el proveedor real es cambio de configuración, no de código.

**La firma electrónica requiere activarse.** Sin configurar el proveedor, el paso de firma funciona en modo de prueba y genera un documento de ejemplo.

**El asistente virtual requiere activarse.** Sin configurar, responde que no está disponible.

**Cambiar el estado de una cuenta** (suspender, desactivar) no tiene pantalla todavía.

**Quitar el rol de administrador o desvincular a un inversionista** tampoco.

Las cuatro últimas son configuración o pantallas pendientes, no problemas del sistema. El manual técnico detalla cómo activar las integraciones.

---

## Dudas frecuentes

**Convertí a alguien y no ve sus inversiones.**
Convertirlo crea su ficha, pero las inversiones son filas de la tabla Capital. Agrégalas ahí, con su ficha y el proyecto.

**Subí un documento y el inversionista no lo ve.**
Revisa la visibilidad. Si es privado, tiene que tener indicado el inversionista. Si es de proyecto, la persona necesita tener capital en ese proyecto.

**Cambié algo y no se refleja.**
Mira el mensaje debajo de la tabla. Si dice "Todos los cambios están guardados", el cambio entró; si hay un error en rojo, no se guardó nada de ese cambio: corrígelo y pulsa Reintentar.

**Alguien se registró con otro correo del que le pusimos.**
Corrige el correo en su ficha de Inversionistas y vuelve a convertirlo desde Usuarios.

**¿Puedo borrar un proyecto o una persona?**
No desde el panel, y es deliberado: borrar arrastraría aportes, documentos y transacciones. Para dar de baja algo, usa su campo de estado.
