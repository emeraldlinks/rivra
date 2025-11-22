import { StartServer, RivraHandler } from "rivra/server";

(async () => {
  const app = await StartServer();
   app.start();
})();


export default RivraHandler;
