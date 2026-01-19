import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      config: {
        auth: { required: false },
      },
    },
    async function (request, reply) {
      return { root: true };
    },
  );
};

export default root;
