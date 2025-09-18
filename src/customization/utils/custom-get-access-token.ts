import { Cookies } from "react-cookie";
import { CFLOW_ACCESS_TOKEN } from "@/constants/constants";

export const customGetAccessToken = () => {
  const cookies = new Cookies();
  return cookies.get(CFLOW_ACCESS_TOKEN);
};
