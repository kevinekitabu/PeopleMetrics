import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link as ScrollLink } from 'react-scroll';
import { useAuth } from '../components/AuthProvider';
import PaymentModal from '../components/PaymentModal';
import AuthModal from '../components/AuthModal';
import toast from 'react-hot-toast';
import '@fortawesome/fontawesome-free/css/all.min.css';
export default function Landing() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isYearly, setIsYearly] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const handleSelectPlan = async (plan, price) => {
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
        toast.success('Successfully signed in!');
        navigate('/dashboard');
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
    return (_jsxs("div", { className: "min-h-screen gradient-background", children: [_jsx("nav", { className: "fixed top-0 left-0 right-0 glass-effect z-50", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsx(Link, { to: "/", className: "text-2xl font-bold text-white text-gradient animate-fade-in", children: "PeopleMetrics" }), _jsxs("div", { className: "hidden md:flex items-center space-x-6", children: [navItems.map((item, index) => (_jsx(ScrollLink, { to: item.to, spy: true, smooth: true, offset: -64, duration: 500, className: "cursor-pointer text-white opacity-80 hover:opacity-100 transition-opacity px-3 py-2 animate-fade-in", style: { animationDelay: `${index * 100}ms` }, children: item.name }, item.to))), user ? (_jsx(Link, { to: "/dashboard", className: "ml-4 px-6 py-2 text-sm font-medium text-white bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all hover-lift animate-fade-in", style: { animationDelay: '600ms' }, children: "Dashboard" })) : (_jsx("button", { onClick: () => setIsAuthModalOpen(true), className: "ml-4 px-6 py-2 text-sm font-medium text-white bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all hover-lift animate-fade-in", style: { animationDelay: '600ms' }, children: "Sign In" }))] })] }) }) }), _jsx("div", { className: "container mx-auto px-4 pt-32 pb-16", children: _jsxs("div", { className: "max-w-4xl mx-auto text-center", children: [_jsxs("h2", { className: "text-5xl font-bold text-white mb-8 animate-slide-up", children: ["Welcome to ", _jsx("span", { className: "text-gradient", children: "PeopleMetrics" })] }), _jsx("p", { className: "text-xl text-white text-opacity-90 mb-12 animate-slide-up", style: { animationDelay: '200ms' }, children: "Empowering businesses with innovative HR solutions to streamline processes and enhance productivity." }), _jsx("div", { className: "space-x-4 animate-slide-up", style: { animationDelay: '400ms' }, children: user ? (_jsx(Link, { to: "/dashboard", className: "inline-block px-8 py-3 text-lg font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all hover-lift animate-pulse-glow", children: "Go to Dashboard" })) : (_jsx("button", { onClick: () => setIsAuthModalOpen(true), className: "inline-block px-8 py-3 text-lg font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all hover-lift animate-pulse-glow", children: "Get Started" })) })] }) }), _jsx("section", { id: "features", className: "py-20", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12 animate-slide-up", children: "Features" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8", children: features.map((feature, index) => (_jsxs("div", { className: "glass-effect p-6 rounded-lg hover-lift card-shine animate-fade-in", style: { animationDelay: `${index * 200}ms` }, children: [_jsx("div", { className: "text-white text-4xl mb-4 animate-float", children: _jsx("i", { className: `fas ${feature.icon}` }) }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: feature.title }), _jsx("p", { className: "text-white text-opacity-80", children: feature.text })] }, index))) })] }) }), _jsx("section", { id: "pricing", className: "py-20 bg-white bg-opacity-5", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx("h2", { className: "text-3xl font-bold text-white mb-4 animate-slide-up", children: "Simple Pricing" }), _jsxs("div", { className: "flex items-center justify-center mb-8 animate-fade-in", children: [_jsx("span", { className: `text-sm ${!isYearly ? 'text-white' : 'text-white text-opacity-70'}`, children: "Monthly" }), _jsx("button", { className: "relative mx-3 flex items-center h-6 w-12 rounded-full bg-primary-600 focus:outline-none transition-colors", onClick: () => setIsYearly(!isYearly), children: _jsx("span", { className: `inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${isYearly ? 'translate-x-7' : 'translate-x-1'}` }) }), _jsxs("span", { className: `text-sm ${isYearly ? 'text-white' : 'text-white text-opacity-70'}`, children: ["Yearly ", _jsx("span", { className: "text-primary-400", children: "(Save 17%)" })] })] })] }), _jsx("div", { className: "max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8", children: [
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
                            ].map((tier, index) => (_jsxs("div", { className: `relative flex flex-col animate-scale-in ${tier.highlighted
                                    ? 'glass-effect shadow-glow md:scale-105'
                                    : 'glass-effect'} rounded-lg hover-lift card-shine`, style: { animationDelay: `${index * 200}ms` }, children: [tier.highlighted && (_jsx("span", { className: "absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-primary-600 text-white px-3 py-1 text-xs font-semibold rounded-full animate-pulse-slow", children: "Popular" })), _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: tier.name }), _jsxs("div", { className: "mb-6", children: [_jsxs("span", { className: "text-4xl font-bold text-white", children: ["$", tier.price] }), _jsxs("span", { className: "text-white text-opacity-70", children: ["/", isYearly ? 'year' : 'month'] })] }), _jsx("ul", { className: "space-y-3 mb-6", children: tier.features.map((feature, featureIndex) => (_jsxs("li", { className: "flex items-center text-white text-opacity-90", children: [_jsx("svg", { className: "h-5 w-5 text-primary-400 mr-2", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), feature] }, featureIndex))) }), _jsx("button", { onClick: () => handleSelectPlan(tier.name, tier.price), className: `w-full py-2 px-4 rounded-lg transition-all ${tier.highlighted
                                                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                                                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'} hover-lift`, children: "Get Started" })] })] }, index))) })] }) }), _jsx("section", { id: "about", className: "py-20 bg-white bg-opacity-5", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "About Us" }), _jsxs("div", { className: "max-w-4xl mx-auto text-center", children: [_jsx("p", { className: "text-lg text-indigo-100 mb-8", children: "PeopleMetricsSolutions provides cutting-edge human resource management solutions designed to simplify and optimize your HR processes. Our platform offers a comprehensive suite of tools to manage employee data, payroll, benefits, and more." }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-white mb-4", children: "Why Choose Us" }), _jsxs("ul", { className: "text-indigo-100 space-y-2", children: [_jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Innovative HR Solutions"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Comprehensive Tools"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "User-Friendly Interface"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Exceptional Customer Support"] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-white mb-4", children: "Our Impact" }), _jsxs("ul", { className: "text-indigo-100 space-y-2", children: [_jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Streamlined Processes"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Enhanced Productivity"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Data-Driven Insights"] }), _jsxs("li", { children: [_jsx("i", { className: "fas fa-check mr-2" }), "Scalable Solutions"] })] })] })] })] })] }) }), _jsx("section", { id: "services", className: "py-20", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "Our Services" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8", children: services.map((service, index) => (_jsxs("div", { className: "bg-white bg-opacity-10 p-6 rounded-lg", children: [_jsx("div", { className: "text-white text-3xl mb-4", children: _jsx("i", { className: `fas ${service.icon}` }) }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: service.name }), _jsx("p", { className: "text-indigo-100", children: service.text })] }, index))) })] }) }), _jsx("section", { id: "gallery", className: "py-20 bg-white bg-opacity-5", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "Gallery" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8", children: gallery.map((item, index) => (_jsxs("div", { className: "bg-white bg-opacity-10 rounded-lg overflow-hidden", children: [_jsx("img", { src: item.image, alt: item.title, className: "w-full h-48 object-cover" }), _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-2", children: item.title }), _jsx("p", { className: "text-indigo-100", children: item.description })] })] }, index))) })] }) }), _jsx("section", { id: "testimonials", className: "py-20", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "Testimonials" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-8", children: testimonials.map((testimonial, index) => (_jsxs("div", { className: "bg-white bg-opacity-10 p-6 rounded-lg", children: [_jsxs("p", { className: "text-indigo-100 mb-4", children: ["\"", testimonial.text, "\""] }), _jsxs("div", { className: "text-white", children: [_jsx("p", { className: "font-semibold", children: testimonial.author }), _jsx("p", { className: "text-sm", children: testimonial.position }), _jsx("p", { className: "text-sm text-indigo-200", children: testimonial.company })] })] }, index))) })] }) }), _jsx("section", { id: "team", className: "py-20 bg-white bg-opacity-5", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "Our Team" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8", children: team.map((member, index) => (_jsxs("div", { className: "bg-white bg-opacity-10 p-6 rounded-lg text-center", children: [_jsx("img", { src: member.img, alt: member.name, className: "w-32 h-32 rounded-full mx-auto mb-4 object-cover" }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: member.name }), _jsx("p", { className: "text-indigo-100", children: member.job })] }, index))) })] }) }), _jsx("section", { id: "contact", className: "py-20", children: _jsxs("div", { className: "container mx-auto px-4", children: [_jsx("h2", { className: "text-3xl font-bold text-white text-center mb-12", children: "Contact Us" }), _jsxs("div", { className: "max-w-2xl mx-auto text-center space-y-4 text-indigo-100", children: [_jsxs("p", { children: [_jsx("i", { className: "fas fa-map-marker-alt mr-2" }), " 15654 - 00503, Mbagathi"] }), _jsxs("p", { children: [_jsx("i", { className: "fas fa-phone mr-2" }), " +254 774350446"] }), _jsxs("p", { children: [_jsx("i", { className: "fas fa-envelope mr-2" }), " peoplemetricssolutions@gmail.com"] })] })] }) }), _jsx(AuthModal, { isOpen: isAuthModalOpen, onClose: () => setIsAuthModalOpen(false), onSuccess: handleAuthSuccess }), selectedPlan && (_jsx(PaymentModal, { isOpen: isPaymentModalOpen, onClose: () => {
                    setIsPaymentModalOpen(false);
                    setSelectedPlan(null);
                }, selectedPlan: selectedPlan }))] }));
}
