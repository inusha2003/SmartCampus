import { Link } from 'react-router-dom'
import { HiOutlineEnvelope, HiOutlinePhone, HiOutlineMapPin } from 'react-icons/hi2'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Smart Campus Hub</h3>
          <p>Campus resource booking and management platform designed for modern universities.</p>
          <div className="footer-socials">
            <a href="#" aria-label="Contact email" title="Email">
              <HiOutlineEnvelope />
            </a>
            <a href="#" aria-label="Contact phone" title="Phone">
              <HiOutlinePhone />
            </a>
            <a href="#" aria-label="Visit campus" title="Location">
              <HiOutlineMapPin />
            </a>
          </div>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li>
              <Link to="/">Catalogue</Link>
            </li>
            <li>
              <Link to="/bookings">My Bookings</Link>
            </li>
            <li>
              <Link to="/tickets">Support</Link>
            </li>
            <li>
              <Link to="/notifications">Notifications</Link>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Resources</h4>
          <ul>
            <li>
              <a href="#help">Help Center</a>
            </li>
            <li>
              <a href="#docs">Documentation</a>
            </li>
            <li>
              <a href="#faq">FAQ</a>
            </li>
            <li>
              <a href="#contact">Contact Us</a>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Legal</h4>
          <ul>
            <li>
              <a href="#privacy">Privacy Policy</a>
            </li>
            <li>
              <a href="#terms">Terms of Service</a>
            </li>
            <li>
              <a href="#cookies">Cookie Policy</a>
            </li>
            <li>
              <a href="#accessibility">Accessibility</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          <p>© {currentYear} Smart Campus Hub. All rights reserved.</p>
        </div>
        <div className="footer-meta">
          <a href="#sitemap">Sitemap</a>
          <span>•</span>
          <a href="#status">System Status</a>
        </div>
      </div>
    </footer>
  )
}
