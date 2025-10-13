import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useAuth } from '../../hooks/useAuth';
import UploadIcon from '../../components/common/UploadIcon';
import ChatIcon from '../../components/common/ChatIcon';
import EditSparkleIcon from '../../components/common/EditSparkleIcon';
import './OnboardingPage.css';

const OnboardingPage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { markOnboardingComplete } = useAuth();

  const slides = [
    {
      icon: <UploadIcon />,
      title: 'Upload your research papers',
      description: 'Add PDF files of academic papers you\'re working with. TeXGPT will analyze and understand the content to brainstorm with you.'
    },
    {
      icon: <ChatIcon />,
      title: 'Brainstorm with TeXGPT',
      description: 'TeXGPT will analyze and study your paper. You can ask any questions or brainstorm with one or multiple papers of choice.'
    },
    {
      icon: <EditSparkleIcon />,
      title: 'Insert ideas to your Latex paper',
      description: 'Once an idea is formed, you can insert them to your Latex paper right on VS Code, with reference format of your choice.'
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    markOnboardingComplete();
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <h1 className="onboarding-main-title">Welcome to TeXGPT</h1>

        <div className="slide-content">
          <div className="slide-icon">{slides[currentSlide].icon}</div>
          <h2 className="slide-title">{slides[currentSlide].title}</h2>
          <b className="slide-description">{slides[currentSlide].description}</b>
        </div>

        <div className="pagination-dots">
          {slides.map((_, index) => (
            <span
              key={index}
              className={`dot ${index === currentSlide ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <VSCodeButton
            appearance="secondary"
            onClick={handleNext}
            className="onboarding-btn"
          >
            <b>{currentSlide === slides.length - 1 ? 'Get started' : 'Next'}</b>
          </VSCodeButton>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleSkip();
            }}
            className="skip-link"
          >
            <b>Skip tutorial</b>
          </a>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
