const { getStore } = require("@netlify/blobs");

/**
 * Netlify Function: guardar-contrato
 * Endpoint para persistir contratos y sus pagos en Netlify Blobs.
 * Método permitido: Únicamente POST
 */
exports.handler = async (event, context) => {
    // 1. Validar método HTTP: únicamente POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST'
            },
            body: JSON.stringify({
                error: 'Method Not Allowed',
                message: 'Este endpoint únicamente acepta solicitudes POST.'
            })
        };
    }

    try {
        // 2. Parsear y validar el payload
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'El cuerpo de la solicitud no puede estar vacío.'
                })
            };
        }

        let payload;
        try {
            payload = JSON.parse(event.body);
        } catch (parseErr) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'El cuerpo de la solicitud contiene JSON inválido.',
                    details: parseErr.message
                })
            };
        }

        // Validar ID obligatorio
        const contractId = payload.id;
        if (!contractId || typeof contractId !== 'string' || !contractId.trim()) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'El campo "id" es obligatorio y debe ser una cadena válida.'
                })
            };
        }

        const sanitizedId = contractId.trim();

        // 3. Conexión al store de Netlify Blobs (namespace/store "contratos")
        const store = getStore("contratos");

        // 4. Preparar datos garantizando timestamp createdAt
        const now = new Date().toISOString();
        const dataToSave = {
            ...payload,
            id: sanitizedId,
            createdAt: payload.createdAt || now,
            updatedAt: now
        };

        // 5. Guardar el objeto en Netlify Blobs asociándolo a su ID
        await store.setJSON(sanitizedId, dataToSave);

        // 6. Respuesta exitosa 200 OK
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `Contrato '${sanitizedId}' guardado exitosamente en Netlify Blobs.`,
                data: dataToSave
            })
        };

    } catch (error) {
        console.error("Error en Netlify Function (guardar-contrato):", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Ocurrió un error al procesar el almacenamiento en Netlify Blobs.',
                details: error.message
            })
        };
    }
};
