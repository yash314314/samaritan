"use client";

import { useEffect, useState } from "react";
import { fetchHeatmap } from "../../lib/api";

import HeatmapGrid from "../../components/HeatmapGrid";
import HeatmapInsights from "../../components/HeatmapInsights";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

export default function HeatmapPage(){

  const [data,setData] = useState<any>(null);

  useEffect(()=>{

    async function load(){

      const heatmap = await fetchHeatmap(USER_ID);

      setData(heatmap);

    }

    load();

  },[]);

  if(!data){

    return(
      <div className="flex items-center justify-center h-64">
        Loading heatmap...
      </div>
    );

  }

  return(

    <div className="space-y-6">

      <HeatmapGrid data={data} />

      <HeatmapInsights data={data} />

    </div>

  );

}