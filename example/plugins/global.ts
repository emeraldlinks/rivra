import type { App, Req, Reply } from "rivra"

export default async function(app: App) {

  // await app.register(cookie, {
  //   secret: "my-secret-key",
  //   parseOptions: {},
  // });
  app.addHook("onRequest", async (req, reply) => {
    console.log("Incoming URL:", req.raw.url);
    reply.header('X-Powered-By', 'Rivra');
    console.log("Cookies:", req.cookies); // Now safe
  });
  app.decorateRequest("user", null);
}

// plugins/some_plugin.ts -> global plugin (all routes)
// plugins/auth.pg.ts -> plugin -> api/auth
// plugins/auth.md.ts -> middleware -> api/auth
// plugins/users/index.ts -> plugin -> api/users
// plugins/users/users.md.ts -> middleware -> api/users
// You can also access "app" for shared logic
