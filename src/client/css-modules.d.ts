/** CSS Modules 类型声明：让 TS 认识 `import css from './x.module.css'`。 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
