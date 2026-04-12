import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileNav from '../components/MobileNav'
import Footer from '../components/Footer'
import styles from './AppLayout.module.css'

export default function AppLayout() {
  return (
    <>
      <MobileNav />
      <div className={styles.layout}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
          <Footer />
        </main>
      </div>
    </>
  )
}
