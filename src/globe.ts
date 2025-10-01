


export function loadPages(): any {
    // @ts-ignore
 const modules = import.meta.glob("/src/pages/**/*.ripple", { eager: true });
return modules
    
}