import * as React from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import ErrorRedirect from "./components/ErrorRedirect";
import JourneyLayout from "./layouts/JourneyLayout";
import MainLayout from "./layouts/MainLayout";
import { JourneyStepNames, RoutePath } from "./lib/models/route-paths";
import CallbackPage from "./routes/CallbackPage";
import ConsentDeniedPage from "./routes/ConsentDeniedPage";
import HomeTestPrivacyPolicyPage from "./routes/HomeTestPrivacyPolicyPage";
import HomeTestTermsOfUsePage from "./routes/HomeTestTermsOfUsePage";
import LoginPage from "./routes/LoginPage";
import OrderTrackingPage from "./routes/OrderTrackingPage";
import ServiceErrorPage from "./routes/ServiceErrorPage";
import SuppliersPrivacyPolicyPage from "./routes/SuppliersPrivacyPolicyPage";
import SuppliersTermsConditionsPage from "./routes/SuppliersTermsConditionsPage";
import TestResultsPage from "./routes/TestResultsPage";
import BeforeYouStartPage from "./routes/get-self-test-kit-for-HIV-journey/BeforeYouStartPage";
import BloodSampleGuidePage from "./routes/get-self-test-kit-for-HIV-journey/BloodSampleGuidePage";
import CannotUseServiceUnder18Page from "./routes/get-self-test-kit-for-HIV-journey/CannotUseServiceUnder18Page";
import CheckYourAnswersPage from "./routes/get-self-test-kit-for-HIV-journey/CheckYourAnswersPage";
import ConfirmMobileNumberPage from "./routes/get-self-test-kit-for-HIV-journey/ConfirmMobileNumberPage";
import EnterAddressManuallyPage from "./routes/get-self-test-kit-for-HIV-journey/EnterAddressManuallyPage";
import EnterDeliveryAddressPage from "./routes/get-self-test-kit-for-HIV-journey/EnterDeliveryAddressPage";
import EnterMobileNumberPage from "./routes/get-self-test-kit-for-HIV-journey/EnterMobileNumberPage";
import FormSuppliersPrivacyPolicyPage from "./routes/get-self-test-kit-for-HIV-journey/FormSuppliersPrivacyPolicyPage";
import FormSuppliersTermsConditionsPage from "./routes/get-self-test-kit-for-HIV-journey/FormSuppliersTermsConditionsPage";
import GetSelfTestKitPage from "./routes/get-self-test-kit-for-HIV-journey/GetSelfTestKitPage";
import GoToClinicPage from "./routes/get-self-test-kit-for-HIV-journey/GoToClinicPage";
import HowComfortablePrickingFingerPage from "./routes/get-self-test-kit-for-HIV-journey/HowComfortablePrickingFingerPage";
import KitNotAvailableInAreaPage from "./routes/get-self-test-kit-for-HIV-journey/KitNotAvailableInAreaPage";
import NoAddressFoundPage from "./routes/get-self-test-kit-for-HIV-journey/NoAddressFoundPage";
import OrderSubmittedPage from "./routes/get-self-test-kit-for-HIV-journey/OrderSubmittedPage";
import SelectDeliveryAddressPage from "./routes/get-self-test-kit-for-HIV-journey/SelectDeliveryAddressPage";

const router = createBrowserRouter([
  // Public routes (must NOT be guarded)
  {
    path: RoutePath.ServiceErrorPage,
    element: (
      <MainLayout>
        <ServiceErrorPage />
      </MainLayout>
    ),
  },
  {
    path: RoutePath.ConsentDeniedPage,
    element: (
      <MainLayout>
        <ConsentDeniedPage />
      </MainLayout>
    ),
  },
  {
    path: RoutePath.LoginPage,
    element: (
      <MainLayout>
        <LoginPage />
      </MainLayout>
    ),
    errorElement: <ErrorRedirect />,
  },
  {
    path: RoutePath.CallbackPage,
    element: (
      <MainLayout>
        <JourneyLayout />
      </MainLayout>
    ),
    errorElement: <ErrorRedirect />,
    children: [
      {
        index: true,
        element: <CallbackPage />,
      },
    ],
  },

  // Guarded app (everything else)
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorRedirect />,
    children: [
      {
        path: RoutePath.HomePage,
        element: <Navigate to={RoutePath.BeforeYouStartPage} replace />,
      },
      {
        path: RoutePath.BeforeYouStartPage,
        element: <BeforeYouStartPage />,
      },
      {
        path: RoutePath.OrderTrackingPage,
        element: <OrderTrackingPage />,
      },
      {
        path: RoutePath.TestResultsPage,
        element: <TestResultsPage />,
      },
      {
        path: RoutePath.SuppliersTermsConditions,
        element: <SuppliersTermsConditionsPage />,
      },
      {
        path: RoutePath.SuppliersPrivacyPolicy,
        element: <SuppliersPrivacyPolicyPage />,
      },
      {
        path: RoutePath.HomeTestPrivacyPolicyPage,
        element: <HomeTestPrivacyPolicyPage />,
      },
      {
        path: RoutePath.HomeTestTermsOfUsePage,
        element: <HomeTestTermsOfUsePage />,
      },
      {
        path: RoutePath.GetSelfTestKitPage,
        element: <JourneyLayout />,
        children: [
          {
            index: true,
            element: <GetSelfTestKitPage />,
          },
          {
            path: JourneyStepNames.EnterAddressManually,
            element: <EnterAddressManuallyPage />,
          },
          {
            path: JourneyStepNames.EnterDeliveryAddress,
            element: <EnterDeliveryAddressPage />,
          },
          {
            path: JourneyStepNames.NoAddressFound,
            element: <NoAddressFoundPage />,
          },
          {
            path: JourneyStepNames.KitNotAvailableInArea,
            element: <KitNotAvailableInAreaPage />,
          },
          {
            path: JourneyStepNames.GoToClinic,
            element: <GoToClinicPage />,
          },
          {
            path: JourneyStepNames.SelectDeliveryAddress,
            element: <SelectDeliveryAddressPage />,
          },
          {
            path: JourneyStepNames.HowComfortablePrickingFinger,
            element: <HowComfortablePrickingFingerPage />,
          },
          {
            path: JourneyStepNames.BloodSampleGuide,
            element: <BloodSampleGuidePage />,
          },
          {
            path: JourneyStepNames.EnterMobileNumber,
            element: <EnterMobileNumberPage />,
          },
          {
            path: JourneyStepNames.ConfirmMobileNumber,
            element: <ConfirmMobileNumberPage />,
          },
          {
            path: JourneyStepNames.CheckYourAnswers,
            element: <CheckYourAnswersPage />,
          },
          {
            path: JourneyStepNames.OrderSubmitted,
            element: <OrderSubmittedPage />,
          },
          {
            path: JourneyStepNames.SuppliersTermsConditions,
            element: <FormSuppliersTermsConditionsPage />,
          },
          {
            path: JourneyStepNames.SuppliersPrivacyPolicy,
            element: <FormSuppliersPrivacyPolicyPage />,
          },
          {
            path: JourneyStepNames.CannotUseServiceUnder18,
            element: <CannotUseServiceUnder18Page />,
          },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

export default App;
