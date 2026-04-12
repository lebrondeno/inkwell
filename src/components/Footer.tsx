import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.logo}>✦ Inkwell</span>
        <em className={styles.credit}>made by lebron deno</em>
      </div>
    </footer>
  )
}
