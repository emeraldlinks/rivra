
export * from "./createFileRoutes";
export * from "./userouter";
export * from "./types";
export * from "./store";
import type { Component } from "ripple";




export {addAliasPlugin} from "./vite-plugin-add-alias"
export { loadPages } from "./globe";



export { default as PageRoutes } from "./rcomponents/page_routes.ripple";
export { Router } from "./rcomponents/router.ripple";
export { default as GlobalLoader } from "./rcomponents/GlobalRouterLoader.ripple";
export {default as Link} from "./rcomponents/link.ripple"
export { default as TopProgress } from "./rcomponents/progress.ripple";



// export declare function Link( href: string,
//     emitEvent: true,
//   children?: Component,
//   onLoading?: () => void,
//   loadingComponent?: Component,
//   className?: string
// ): void