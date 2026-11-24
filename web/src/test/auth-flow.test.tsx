import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../pages/AuthPages";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { getReceiptRefetchInterval } from "../pages/ReceiptsPage";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; name: string; role: "USER" },
  isLoading: false,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    ...authState,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("login form", () => {
  it("shows validation when email or password is invalid", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("valid email");
  });

  describe("protected route", () => {
    it("redirects unauthenticated users to login", () => {
      authState.user = null;
      authState.isLoading = false;
      render(
        <MemoryRouter initialEntries={["/receipts"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/receipts" element={<div>Receipts</div>} />
            </Route>
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
  });

  describe("receipt polling", () => {
    it("stops polling when no receipt is pending", () => {
      expect(getReceiptRefetchInterval([
        { id: "1", status: "CONFIRMED", createdAt: "", updatedAt: "" },
      ])).toBe(false);
    });
  });
});
