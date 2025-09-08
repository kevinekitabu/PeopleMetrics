import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link as ScrollLink } from 'react-scroll';
import { useAuth } from '../components/AuthProvider';
import PaymentModal from '../components/PaymentModal';
import AuthModal from '../components/AuthModal';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import '@fortawesome/fontawesome-free/css/all.min.css';

export default function Landing() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    name: string;
    price: number;
    interval: 'month' | 'year';
  } | null>(null);

  const handleGetStarted = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    navigate('/dashboard');
  };

  const handleSelectPlan = async (plan: string, price: number) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedPlan({
      name: plan,
      price: price,
      interval: isYearly ? 'year' : 'month'
    });
    setIsPaymentModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    toast.success('Welcome! Please select a plan to get started.');
    // Don't auto-navigate, let them choose a plan first
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  const navItems = [
    { name: 'Features', to: 'features' },
    { name: 'Pricing', to: 'pricing' },
    { name: 'About', to: 'about' },
    { name: 'Services', to: 'services' },
    { name: 'Gallery', to: 'gallery' },
    { name: 'Team', to: 'team' },
    { name: 'Contact', to: 'contact' },
  ];

  const features = [
    {
      icon: "fa-comments",
      title: "24/7 Support",
      text: "Our dedicated support team is available around the clock to assist you with any issues or questions."
    },
    {
      icon: "fa-bullhorn",
      title: "Customizable Solutions",
      text: "Tailor our platform to meet your specific needs with our customizable solutions."
    },
    {
      icon: "fa-users",
      title: "User-Friendly Interface",
      text: "Our platform is designed with a user-friendly interface, making it easy for anyone to use."
    },
    {
      icon: "fa-wand-magic-sparkles",
      title: "Innovative Technology",
      text: "Leverage the latest technology to enhance your HR processes and stay ahead of the competition."
    }
  ];

  const services = [
    {
      icon: "fa-cogs",
      name: "HR Management",
      text: "Streamline your HR processes with our all-in-one management platform."
    },
    {
      icon: "fa-chart-line",
      name: "Analytics & Reporting",
      text: "Gain valuable insights with our advanced analytics and reporting tools."
    },
    {
      icon: "fa-users",
      name: "Employee Engagement",
      text: "Boost employee engagement with our suite of communication tools."
    },
    {
      icon: "fa-shield",
      name: "Compliance & Security",
      text: "Ensure compliance and protect your data with robust security measures."
    }
  ];

  const gallery = [
    {
      title: "HR Dashboard",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800",
      description: "Modern HR analytics dashboard"
    },
    {
      title: "Team Collaboration",
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800",
      description: "Enhanced team collaboration tools"
    },
    {
      title: "Data Security",
      image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800",
      description: "Enterprise-grade security measures"
    },
    {
      title: "Mobile Access",
      image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800",
      description: "Access your data anywhere"
    }
  ];

  const testimonials = [
    {
      text: "PeopleMetrics has transformed how we manage our HR processes. The platform is intuitive and the support is exceptional.",
      author: "Sarah Johnson",
      position: "HR Director",
      company: "Tech Solutions Inc."
    },
    {
      text: "The analytics capabilities have given us valuable insights into our workforce, helping us make better decisions.",
      author: "Michael Chen",
      position: "CEO",
      company: "Innovation Corp"
    },
    {
      text: "Implementation was smooth and the team was incredibly helpful throughout the process.",
      author: "Emily Rodriguez",
      position: "Operations Manager",
      company: "Global Systems"
    }
  ];

  const team = [
    {
      img: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e",
      name: "Michelle Gacigi",
      job: "Chief Executive Officer"
    },
    {
      img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
      name: "Simon",
      job: "Chief Operations Officer"
    },
    {
      img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7",
      name: "Lenny Makori",
      job: "Chief Technology Officer"
    },
    {
      img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
      name: "Kevin Irungu",
      job: "Technology Consultant"
    }
  ];

  return (
    <div className="min-h-screen bg-orange-50 dark:bg-blue-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-orange-100 dark:bg-blue-900 border-b border-orange-200 dark:border-blue-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-blue-900 dark:text-yellow-300 animate-fade-in">
              <span className="inline-block"><i className="fas fa-chart-bar text-yellow-400 mr-2"></i></span>
              PeopleMetrics
            </Link>

            {/* Mobile menu button and theme toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-blue-900 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Toggle menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {navItems.map((item, index) => (
                <ScrollLink
                  key={item.to}
                  to={item.to}
                  spy={true}
                  smooth={true}
                  offset={-64}
                  duration={500}
                  className="cursor-pointer text-blue-900 dark:text-yellow-200 opacity-80 hover:opacity-100 transition-opacity px-2 py-1 text-sm font-medium animate-fade-in focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {item.name}
                </ScrollLink>
              ))}
              <ThemeToggle />
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="px-4 py-1.5 text-sm font-semibold text-blue-900 dark:text-yellow-200 bg-yellow-200 dark:bg-blue-800 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-all hover-lift animate-fade-in focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    style={{ animationDelay: '600ms' }}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-900 dark:bg-yellow-400 dark:text-blue-900 rounded-lg hover:bg-blue-800 dark:hover:bg-yellow-300 transition-all hover-lift animate-fade-in focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    style={{ animationDelay: '700ms' }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-900 dark:bg-yellow-400 dark:text-blue-900 rounded-lg hover:bg-blue-800 dark:hover:bg-yellow-300 transition-all hover-lift animate-fade-in focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  style={{ animationDelay: '600ms' }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 space-y-1 animate-fade-in border-t border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-900 rounded-b-xl shadow-lg">
              {navItems.map((item) => (
                <ScrollLink
                  key={item.to}
                  to={item.to}
                  spy={true}
                  smooth={true}
                  offset={-64}
                  duration={500}
                  className="block text-blue-900 dark:text-yellow-200 opacity-80 hover:opacity-100 transition-opacity px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </ScrollLink>
              ))}
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-semibold text-blue-900 dark:text-yellow-200 bg-yellow-200 dark:bg-blue-800 rounded-lg hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm font-semibold text-white bg-blue-900 dark:bg-yellow-400 dark:text-blue-900 rounded-lg hover:bg-blue-800 dark:hover:bg-yellow-300 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm font-semibold text-white bg-blue-900 dark:bg-yellow-400 dark:text-blue-900 rounded-lg hover:bg-blue-800 dark:hover:bg-yellow-300 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  Sign In
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 dark:text-yellow-300 mb-6 md:mb-8 animate-slide-up">
            Welcome to <span className="text-yellow-400">PeopleMetrics</span>
          </h2>
          <p className="text-lg md:text-xl text-blue-800 dark:text-yellow-200 mb-8 md:mb-12 animate-slide-up px-4" style={{ animationDelay: '200ms' }}>
            Empowering businesses with innovative HR solutions to streamline processes and enhance productivity.
          </p>
          <div className="space-x-4 animate-slide-up" style={{ animationDelay: '400ms' }}>
            <button
              onClick={handleGetStarted}
              className="inline-block px-6 py-3 text-base md:text-lg font-medium text-white bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-400 rounded-lg transition-all hover-lift animate-pulse-glow"
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12 animate-slide-up">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white dark:bg-blue-900 p-6 rounded-lg hover-lift card-shine animate-fade-in border border-blue-100 dark:border-blue-800 shadow-sm"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="text-yellow-400 text-3xl md:text-4xl mb-4 animate-float">
                  <i className={`fas ${feature.icon}`}></i>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-blue-900 dark:text-yellow-200 mb-2">{feature.title}</h3>
                <p className="text-blue-800 dark:text-yellow-100 text-sm md:text-base">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-20 bg-white/5 dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 mb-4 animate-slide-up">Simple Pricing</h2>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-8 animate-fade-in">
              <span className={`text-sm ${!isYearly ? 'text-blue-900 dark:text-yellow-200' : 'text-blue-300 dark:text-yellow-400'}`}>Monthly</span>
              <button
                className="relative mx-3 flex items-center h-6 w-12 rounded-full bg-yellow-200 dark:bg-blue-800 focus:outline-none transition-colors"
                onClick={() => setIsYearly(!isYearly)}
              >
                <span
                  className={`inline-block w-4 h-4 transform transition-transform bg-white dark:bg-yellow-400 rounded-full ${
                    isYearly ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${isYearly ? 'text-blue-900 dark:text-yellow-200' : 'text-blue-300 dark:text-yellow-400'}`}>Yearly <span className="text-yellow-400">(Save 17%)</span></span>
            </div>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                name: 'Basic',
                price: isYearly ? 200 : 20,
                features: [
                  '100 reports',
                  'Basic AI analysis',
                  'Email support',
                  'Standard processing'
                ]
              },
              {
                name: 'Pro',
                price: isYearly ? 500 : 50,
                features: [
                  '1,000 reports',
                  'Advanced AI',
                  'Priority support',
                  'Fast processing'
                ],
                highlighted: true
              },
              {
                name: 'Enterprise',
                price: isYearly ? 700 : 70,
                features: [
                  'Unlimited reports',
                  'Enterprise AI',
                  '24/7 support',
                  'API access'
                ]
              }
            ].map((tier, index) => (
              <div
                key={index}
                className={`relative flex flex-col animate-scale-in ${
                  tier.highlighted
                    ? 'bg-white dark:bg-blue-900 shadow-lg border-2 border-yellow-400 dark:border-yellow-400 md:scale-105'
                    : 'bg-white dark:bg-blue-900 border border-blue-100 dark:border-blue-800 shadow-sm'
                } rounded-lg hover-lift card-shine`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {tier.highlighted && (
                  <span className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-yellow-400 text-blue-900 dark:bg-yellow-400 dark:text-blue-900 px-3 py-1 text-xs font-semibold rounded-full animate-pulse-slow">
                    Popular
                  </span>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-blue-900 dark:text-yellow-200 mb-2">{tier.name}</h3>
                  <div className="mb-6">
                    <span className="text-3xl md:text-4xl font-bold text-yellow-400">
                      ${tier.price}
                    </span>
                    <span className="text-blue-800 dark:text-yellow-100">/{isYearly ? 'year' : 'month'}</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-blue-800 dark:text-yellow-100 text-sm">
                        <svg
                          className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelectPlan(tier.name, tier.price)}
                    className={`w-full py-2 px-4 rounded-lg transition-all text-sm font-semibold ${
                      tier.highlighted
                        ? 'bg-yellow-400 text-blue-900 hover:bg-yellow-500 dark:bg-yellow-400 dark:hover:bg-yellow-300'
                        : 'bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700'
                    } hover-lift`}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">About Us</h2>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-base md:text-lg text-blue-800 dark:text-yellow-100 mb-8">
              PeopleMetricsSolutions provides cutting-edge human resource management solutions designed to simplify and optimize your HR processes. Our platform offers a comprehensive suite of tools to manage employee data, payroll, benefits, and more.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-blue-900 p-6 rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm">
                <h3 className="text-lg md:text-xl font-semibold text-blue-900 dark:text-yellow-200 mb-4">Why Choose Us</h3>
                <ul className="text-blue-800 dark:text-yellow-100 space-y-2 text-sm md:text-base">
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Innovative HR Solutions</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Comprehensive Tools</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>User-Friendly Interface</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Exceptional Customer Support</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-blue-900 p-6 rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm">
                <h3 className="text-lg md:text-xl font-semibold text-blue-blue-900 dark:text-yellow-200 mb-4">Our Impact</h3>
                <ul className="text-blue-800 dark:text-yellow-100 space-y-2 text-sm md:text-base">
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Streamlined Processes</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Enhanced Productivity</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Data-Driven Insights</li>
                  <li><i className="fas fa-check mr-2 text-yellow-400"></i>Scalable Solutions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">Our Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-white dark:bg-blue-900 p-6 rounded-lg hover-lift border border-blue-100 dark:border-blue-800 shadow-sm">
                <div className="text-yellow-400 text-3xl mb-4">
                  <i className={`fas ${service.icon}`}></i>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-blue-900 dark:text-yellow-200 mb-2">{service.name}</h3>
                <p className="text-blue-800 dark:text-yellow-100 text-sm md:text-base">{service.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">Gallery</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {gallery.map((item, index) => (
              <div key={index} className="bg-white dark:bg-blue-900 rounded-lg overflow-hidden hover-lift border border-blue-100 dark:border-blue-800 shadow-sm">
                <img src={item.image} alt={item.title} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-yellow-200 mb-2">{item.title}</h3>
                  <p className="text-blue-800 dark:text-yellow-100 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">Testimonials</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white dark:bg-blue-900 p-6 rounded-lg hover-lift border border-blue-100 dark:border-blue-800 shadow-sm">
                <p className="text-blue-800 dark:text-yellow-100 mb-4 text-sm md:text-base">"{testimonial.text}"</p>
                <div className="text-blue-900 dark:text-yellow-200">
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm">{testimonial.position}</p>
                  <p className="text-sm text-yellow-400">{testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">Our Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {team.map((member, index) => (
              <div key={index} className="bg-white dark:bg-blue-900 p-6 rounded-lg text-center hover-lift border border-blue-100 dark:border-blue-800 shadow-sm">
                <img
                  src={member.img}
                  alt={member.name}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="text-lg md:text-xl font-semibold text-blue-900 dark:text-yellow-200 mb-2">{member.name}</h3>
                <p className="text-blue-800 dark:text-yellow-100 text-sm md:text-base">{member.job}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 md:py-20 bg-white dark:bg-blue-950">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-yellow-300 text-center mb-8 md:mb-12">Contact Us</h2>
          <div className="max-w-2xl mx-auto text-center space-y-4 bg-white dark:bg-blue-900 p-6 rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm">
            <p className="text-blue-800 dark:text-yellow-100"><i className="fas fa-map-marker-alt mr-2 text-yellow-400"></i> 15654 - 00503, Mbagathi</p>
            <p className="text-blue-800 dark:text-yellow-100"><i className="fas fa-phone mr-2 text-yellow-400"></i> +254 774350446</p>
            <p className="text-blue-800 dark:text-yellow-100"><i className="fas fa-envelope mr-2 text-yellow-400"></i> peoplemetricssolutions@gmail.com</p>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPlan(null);
          }}
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
}