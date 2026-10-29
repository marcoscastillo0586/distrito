const { getStore } = require("@netlify/blobs");

/**
 * Netlify Function: eliminar-contrato
 * Endpoint para eliminar contratos de Netlify Blobs.
 * Métodos permitidos: POST o DELETE
 */
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': 'POST, DELETE'
            },
            body: JSON.stringify({
                error: 'Method Not Allowed',
                message: 'Este endpoint únicamente acepta solicitudes POST o DELETE.'
            })
        };
    }

    try {
        let contractId = null;
        if (event.queryStringParameters && event.queryStringParameters.id) {
            contractId = event.queryStringParameters.id;
        } else if (event.body) {
            try {
                const parsed = JSON.parse(event.body);
                contractId = parsed.id;
            } catch (e) {
                // Ignore parsing errors
            }
        }

        if (!contractId || typeof contractId !== 'string') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Bad Request',
                    message: 'El identificador "id" del contrato es obligatorio.'
                })
            };
        }

        const store = getStore("contratos");
        await store.delete(contractId.trim());

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `Contrato '${contractId}' eliminado exitosamente de Netlify Blobs.`
            })
        };
    } catch (error) {
        console.error("Error en Netlify Function (eliminar-contrato):", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'Ocurrió un error al eliminar el contrato en Netlify Blobs.',
                details: error.message
            })
        };
    }
};
