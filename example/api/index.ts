import type { Req, Reply } from "rivra"

export default async function handler(req: Req, res: Reply) {
  if (req.method !== "GET") return res.status(405).send({ message: "Method not allowed" });
  res.status(200).send({ hello: "serverless" });
}
